#!/usr/bin/env node
// Two-phase approach designed for small local models (llama3:8b etc.):
//
// Phase 1 — LLM diagnosis: ask the model ONLY to identify the broken file
//   and line number(s). No diff generation — small models hallucinate diffs.
//
// Phase 2 — Script-generated patch: the script reads the actual file and
//   mechanically removes/edits the identified lines, then runs `git diff`
//   to produce a syntactically perfect unified diff. `git apply` is
//   guaranteed to succeed on a diff we generated ourselves.
//
// This completely sidesteps the diff-format hallucination problem.
// Exits cleanly (changed=false) when the model isn't confident — no PR.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const MAX_LOG_CHARS = 8_000;
const OUT_DIR = '.ai-fixer';
const MODEL = process.env.OLLAMA_MODEL || 'llama3';
const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 120_000;

const logPath = process.env.LOG_PATH;
const runUrl  = process.env.RUN_URL;
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

if (!process.env.OLLAMA_BASE_URL) failClean('OLLAMA_BASE_URL is not configured');

const rawLog = readFileSync(logPath, 'utf8');
const log = rawLog.length > MAX_LOG_CHARS ? rawLog.slice(-MAX_LOG_CHARS) : rawLog;

// ---------------------------------------------------------------------------
// Phase 1: ask the model for diagnosis only — file path + line numbers.
// We deliberately do NOT ask it for a diff.
// ---------------------------------------------------------------------------
const systemPrompt = `You are a senior engineer analysing a failed CI run for a
TypeScript monorepo (NestJS backend, React/Vite frontend).

Your ONLY job is to identify the exact source file and line number(s) that
caused the failure, based on the error log provided.

Respond with a JSON object matching this schema exactly:
{
  "confident": boolean,
  "file": "repo-root-relative path to the file, e.g. backend/src/main.ts",
  "lines_to_delete": [array of 1-based line numbers to remove, e.g. [61, 62]],
  "summary": "one sentence: what broke and why",
  "explanation": "one sentence: what removing those lines fixes"
}

Rules:
- Set "confident": true ONLY when the log contains an explicit file path and
  line number (e.g. "backend/src/main.ts:62:7  error  ...").
- "lines_to_delete" must contain every line that should be removed to fix the
  error. For an unused variable that spans two lines (blank line + declaration)
  include both line numbers.
- Never include workflow files, lockfiles, or migration files.
- If the log does not contain a clear file:line reference, set
  "confident": false and leave "file" as "" and "lines_to_delete" as [].`;

const userPrompt = `Failing CI run: ${runUrl}
Commit: ${headSha}

Error log:

${log}`;

let diagnosis;
try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
          { role: 'user',   content: userPrompt },
        ],
        format: {
          type: 'object',
          properties: {
            confident:        { type: 'boolean' },
            file:             { type: 'string' },
            lines_to_delete:  { type: 'array', items: { type: 'number' } },
            summary:          { type: 'string' },
            explanation:      { type: 'string' },
          },
          required: ['confident', 'file', 'lines_to_delete', 'summary', 'explanation'],
        },
        stream: false,
        options: { temperature: 0 },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);

  const completion = await res.json();
  const text = completion?.message?.content?.trim() ?? '';
  console.log('--- model diagnosis ---');
  console.log(text);
  console.log('--- end diagnosis ---');
  diagnosis = JSON.parse(text);
} catch (err) {
  failClean(`LLM call failed: ${err.message}`);
}

console.log(`confident=${diagnosis.confident} file=${diagnosis.file} lines=${JSON.stringify(diagnosis.lines_to_delete)}`);

if (!diagnosis.confident) failClean('model was not confident enough to identify the failing line');
if (!diagnosis.file)      failClean('model did not identify a target file');
if (!Array.isArray(diagnosis.lines_to_delete) || diagnosis.lines_to_delete.length === 0) {
  failClean('model did not identify lines to delete');
}

// ---------------------------------------------------------------------------
// Phase 2: mechanically delete the identified lines and produce a real diff.
// The model never touches diff syntax — we generate it from git.
// ---------------------------------------------------------------------------
if (!existsSync(diagnosis.file)) {
  failClean(`identified file does not exist in workspace: ${diagnosis.file}`);
}

const fileLines  = readFileSync(diagnosis.file, 'utf8').split('\n');
const toDelete   = new Set(diagnosis.lines_to_delete.map(Number));
const maxLine    = Math.max(...toDelete);

if (maxLine > fileLines.length) {
  failClean(`line ${maxLine} is out of range (file has ${fileLines.length} lines)`);
}

// Sanity check: every line to delete must exist and be non-empty or a blank
// separator — reject if a line looks like function/class scaffolding.
const UNSAFE_PATTERNS = /^\s*(export|import|function|class|interface|type\s+\w|const\s+\w.*=>|@)/;
for (const lineNum of toDelete) {
  const content = fileLines[lineNum - 1] ?? '';
  if (UNSAFE_PATTERNS.test(content)) {
    failClean(`line ${lineNum} looks like structural code ("${content.trim()}") — refusing to delete`);
  }
}

const patched = fileLines.filter((_, idx) => !toDelete.has(idx + 1)).join('\n');
writeFileSync(diagnosis.file, patched, 'utf8');

// Generate the diff from git's own comparison — guaranteed to be valid.
let diff;
try {
  diff = execSync(`git diff -- ${diagnosis.file}`, { encoding: 'utf8' });
} catch (_) {
  diff = '';
}

if (!diff.trim()) failClean('file was unchanged after applying line deletions — nothing to commit');

writeFileSync(`${OUT_DIR}/patch.diff`, diff);
console.log('Patch applied. Diff:');
console.log(diff);

// ---------------------------------------------------------------------------
// Write PR metadata
// ---------------------------------------------------------------------------
const logExcerpt = log.split('\n').filter(l => l.trim()).slice(-20).join('\n');

writeFileSync(`${OUT_DIR}/pr-title.txt`, `Fix CI failure on ${headSha.slice(0, 7)}`);

writeFileSync(`${OUT_DIR}/pr-body.md`, `## ❌ What Broke
${diagnosis.summary}

<details>
<summary>Error log excerpt</summary>

\`\`\`
${logExcerpt}
\`\`\`

[Full failed run](${runUrl}) · commit \`${headSha}\`
</details>

## 🛠️ Proposed Fix
${diagnosis.explanation}

Deleted line(s) ${diagnosis.lines_to_delete.join(', ')} from \`${diagnosis.file}\`.

## ⚠️ Disclaimer
This pull request was opened **autonomously by an AI agent** in response to a
CI failure on \`main\`. It has **not been reviewed by a human** and may be
incomplete, incorrect, or unsafe. Do not merge without:
- reading the diff in full,
- confirming CI passes on this branch,
- verifying the fix addresses the root cause rather than masking it.

If this patch is wrong or unhelpful, simply close this PR — it will not be
reopened automatically.
`);

setOutput('changed', 'true');
console.log('Patch generated and applied successfully.');
