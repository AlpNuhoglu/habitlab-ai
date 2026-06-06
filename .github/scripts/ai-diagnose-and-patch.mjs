#!/usr/bin/env node
// Reads the trailing CI failure log, asks an LLM to (a) diagnose the failure
// and (b) propose a patch as a unified diff, applies the diff, and writes
// the draft-PR title/body. Exits cleanly (changed=false) if the model can't
// produce a confident, applicable patch — the workflow then opens no PR.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MAX_LOG_CHARS = 12_000;
const OUT_DIR = '.ai-fixer';
const MODEL = process.env.OLLAMA_MODEL || 'llama3';
const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 120_000;

const logPath = process.env.LOG_PATH;
const runUrl = process.env.RUN_URL;
const headSha = process.env.HEAD_SHA;

mkdirSync(OUT_DIR, { recursive: true });

function setOutput(name, value) {
  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

function failClean(reason) {
  console.log(`No patch produced: ${reason}`);
  setOutput('changed', 'false');
  process.exit(0);
}

if (!process.env.OLLAMA_BASE_URL) {
  failClean('OLLAMA_BASE_URL is not configured');
}

const rawLog = readFileSync(logPath, 'utf8');
const log = rawLog.length > MAX_LOG_CHARS ? rawLog.slice(-MAX_LOG_CHARS) : rawLog;

const systemPrompt = `You are a careful senior engineer reviewing a failed CI run.
You will be given the trailing portion of the CI failure log for a TypeScript
monorepo (NestJS backend, React/Vite frontend).

Respond with ONLY a single JSON object — no markdown fences, no commentary —
matching this shape exactly:

{
  "confident": boolean,
  "summary": "one or two sentences describing what broke and why, for a PR description",
  "explanation": "one or two sentences describing what your patch changes and why it should fix the failure",
  "diff": "a unified diff (git apply -p1 compatible) containing the minimal fix, or empty string if not confident"
}

Rules:
- Only set "confident": true if the log clearly identifies a specific file,
  symbol, or assertion you can fix with a small, targeted change.
- The diff must touch only files necessary to fix the reported failure.
- Never modify CI workflow files, lockfiles, or migration files.
- If you cannot identify a precise fix, set "confident": false and leave
  "diff" as an empty string — do not guess.`;

const userPrompt = `CI run: ${runUrl}\nCommit: ${headSha}\n\nTrailing failure log:\n\n${log}`;

let parsed;
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0 },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Ollama responded with HTTP ${res.status}: ${await res.text()}`);
  }

  const completion = await res.json();
  const text = completion?.message?.content?.trim() ?? '';
  parsed = JSON.parse(text);
} catch (err) {
  failClean(`LLM call or response parsing failed: ${err.message}`);
}

if (!parsed.confident || !parsed.diff || !parsed.diff.trim()) {
  failClean('model was not confident enough to propose a patch');
}

writeFileSync(`${OUT_DIR}/patch.diff`, parsed.diff);

try {
  execFileSync('git', ['apply', '--check', `${OUT_DIR}/patch.diff`], { stdio: 'pipe' });
  execFileSync('git', ['apply', `${OUT_DIR}/patch.diff`], { stdio: 'inherit' });
} catch (err) {
  failClean(`proposed diff did not apply cleanly: ${err.message}`);
}

const logExcerpt = log
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .slice(-25)
  .join('\n');

writeFileSync(`${OUT_DIR}/pr-title.txt`, `Fix CI failure on ${headSha.slice(0, 7)}`);

const body = `## ❌ What Broke
${parsed.summary}

<details>
<summary>Trailing log excerpt</summary>

\`\`\`
${logExcerpt}
\`\`\`

[Full failed run](${runUrl}) · commit \`${headSha}\`
</details>

## 🛠️ Proposed Fix
${parsed.explanation}

## ⚠️ Disclaimer
This pull request was opened **autonomously by an AI agent** in response to a
CI failure on \`main\`. It has **not been reviewed by a human** and may be
incomplete, incorrect, or unsafe. Do not merge without:
- reading the diff in full,
- confirming CI passes on this branch,
- verifying the fix addresses the root cause rather than masking it.

If this patch is wrong or unhelpful, simply close this PR — it will not be
reopened automatically.
`;

writeFileSync(`${OUT_DIR}/pr-body.md`, body);
setOutput('changed', 'true');
console.log('Patch generated and applied successfully.');
