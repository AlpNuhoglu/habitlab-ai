#!/usr/bin/env node
// Three-phase approach designed for small local models (llama3:8b etc.):
//
// Phase 1  — LLM diagnosis (compiler/lint errors): ask the model ONLY to
//   identify the broken file and line number(s). No diff generation — small
//   models hallucinate diffs.
//
// Phase 1b — LLM diagnosis (test failures): activated when Phase 1 returns
//   confident=false AND the log contains a Jest/Vitest "●" failure block.
//   The script extracts the failing test file path and its primary source
//   import, reads both files, and asks the model for a targeted line edit in
//   the source file. The model still never generates diff syntax.
//
// Phase 2  — Script-generated patch: the script reads the actual file and
//   mechanically applies the edit identified by Phase 1 or Phase 1b, then
//   runs `git diff` to produce a syntactically perfect unified diff.
//   `git apply` is guaranteed to succeed on a diff we generated ourselves.
//
// Exits cleanly (changed=false) when neither phase produces a confident fix.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';

const MAX_LOG_CHARS      = 8_000;
const MAX_SOURCE_CHARS   = 6_000; // per file sent to model in Phase 1b
const OUT_DIR            = '.ai-fixer';
const MODEL    = process.env.OLLAMA_MODEL    || 'llama3';
const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 120_000;

const logPath = process.env.LOG_PATH;
const runUrl  = process.env.RUN_URL;
const headSha = process.env.HEAD_SHA;

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function setOutput(name, value) {
  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

function failClean(reason) {
  console.log(`No patch produced: ${reason}`);
  setOutput('changed', 'false');
  process.exit(0);
}

function truncate(str, maxChars) {
  if (str.length <= maxChars) return str;
  // Keep the tail — errors appear at the end of logs and at the bottom of files.
  return `[… truncated ${str.length - maxChars} chars …]\n` + str.slice(-maxChars);
}

async function callOllama(messages, schema) {
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
        messages,
        format: schema,
        stream: false,
        options: { temperature: 0 },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const completion = await res.json();
  return completion?.message?.content?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

if (!process.env.OLLAMA_BASE_URL) failClean('OLLAMA_BASE_URL is not configured');

const rawLog = readFileSync(logPath, 'utf8');
// Strip GitHub Actions timestamp prefix from every line before any processing.
// Raw lines look like: "2026-06-07T12:28:51.1234567Z  ❯ src/..."
// Keeping them confuses both the model and the regex-based failure detection.
const cleanLog = rawLog.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/gm, '');
const log      = truncate(cleanLog, MAX_LOG_CHARS);

// ---------------------------------------------------------------------------
// Phase 1: compiler / lint diagnosis
// Ask the model for a file + lines_to_delete from an explicit file:line ref.
// ---------------------------------------------------------------------------

const phase1System = `You are a senior engineer analysing a failed CI run for a
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
  line number pointing at a SOURCE file (e.g. "backend/src/main.ts:62:7  error").
- "lines_to_delete" must contain every line that should be removed to fix the
  error. For an unused variable that spans two lines include both line numbers.
- Never target test files, workflow files, lockfiles, or migration files.
- If the log points only at a test file or does not contain a clear file:line
  reference in a source file, set "confident": false and leave "file" as ""
  and "lines_to_delete" as [].`;

const phase1User = `Failing CI run: ${runUrl}
Commit: ${headSha}

Error log:

${log}`;

let diagnosis;
try {
  const text = await callOllama(
    [{ role: 'system', content: phase1System }, { role: 'user', content: phase1User }],
    {
      type: 'object',
      properties: {
        confident:       { type: 'boolean' },
        file:            { type: 'string' },
        lines_to_delete: { type: 'array', items: { type: 'number' } },
        summary:         { type: 'string' },
        explanation:     { type: 'string' },
      },
      required: ['confident', 'file', 'lines_to_delete', 'summary', 'explanation'],
    },
  );
  console.log('--- phase 1 diagnosis ---');
  console.log(text);
  console.log('--- end phase 1 ---');
  diagnosis = JSON.parse(text);
} catch (err) {
  failClean(`Phase 1 LLM call failed: ${err.message}`);
}

console.log(`phase1: confident=${diagnosis.confident} file=${diagnosis.file} lines=${JSON.stringify(diagnosis.lines_to_delete)}`);

// Phase 1 guard: normalise absolute CI paths to repo-relative, then verify
// the file actually exists. Demote to not-confident if it doesn't so Phase 1b
// gets a chance to run.
if (diagnosis.confident) {
  let f = diagnosis.file ?? '';
  // The model sometimes returns the full runner path
  // e.g. /home/runner/work/habitlab-ai/habitlab-ai/frontend/src/lib/foo.ts
  // Strip everything up to and including the second copy of the repo name.
  const runnerPrefixRe = /^\/home\/runner\/work\/[^/]+\/[^/]+\//;
  if (runnerPrefixRe.test(f)) {
    f = f.replace(runnerPrefixRe, '');
    console.log(`Phase 1: normalised runner path → ${f}`);
    diagnosis.file = f;
  }
  const looksReal =
    f !== '' &&
    !f.startsWith('/') &&   // reject any remaining absolute path
    existsSync(f);
  if (!looksReal) {
    console.log(`Phase 1 claimed confident but file "${f}" does not exist in workspace — demoting to not-confident`);
    diagnosis.confident = false;
  }
}

// ---------------------------------------------------------------------------
// Phase 1b: test-failure diagnosis
// Activated when Phase 1 is not confident AND the log contains a Jest/Vitest
// failure block that points at a test file we can find in the workspace.
// ---------------------------------------------------------------------------

// Strip GitHub Actions timestamp prefixes from every line so that regex
// anchors work correctly. CI logs look like:
//   2026-06-07T12:28:51.1234567Z  ❯ src/lib/streak-bonus.test.ts:11:38
//   2026-06-07T12:28:51.1234567Z  ● streakBonusMultiplier › ...
// The timestamp+Z prefix must be removed before any pattern matching.
function stripTimestamps(logText) {
  return logText.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/gm, '');
}

// Detect a Jest/Vitest failure block and extract the test file path.
// Supports both Jest   ("at Object.<anonymous> (path/file.test.ts:line:col)")
// and Vitest           ("❯ path/file.test.ts:line:col")
// and the FAIL header  ("FAIL src/...")
function extractTestFailureContext(logText) {
  const clean = stripTimestamps(logText);

  const hasFailureBlock =
    /^\s*●\s+/m.test(clean) ||
    /^FAIL\s+/m.test(clean) ||
    /❯\s+\S+\.(test|spec)\.(ts|tsx|js|jsx):\d+/m.test(clean);

  if (!hasFailureBlock) return null;

  // Vitest stack frame: "❯ src/lib/streak-bonus.test.ts:11:38"
  const vitestRe = /❯\s+([\w./\-]+\.(test|spec)\.(ts|tsx|js|jsx)):\d+/g;
  let match;
  while ((match = vitestRe.exec(clean)) !== null) {
    if (existsSync(match[1])) return match[1];
  }

  // Jest stack frame: "at Object.<anonymous> (src/...test.ts:42:5)"
  const jestRe = /at Object\.<anonymous> \(([^)]+\.(test|spec)\.(ts|tsx|js|jsx)):\d+:\d+\)/g;
  while ((match = jestRe.exec(clean)) !== null) {
    if (existsSync(match[1])) return match[1];
  }

  // Fallback: FAIL header line — "FAIL src/lib/streak-bonus.test.ts"
  const failRe = /^FAIL\s+([\w./\-]+\.(test|spec)\.(ts|tsx|js|jsx))/m;
  const failMatch = failRe.exec(clean);
  if (failMatch && existsSync(failMatch[1])) return failMatch[1];

  return null;
}

// Given a test file path, find the primary source file it is testing by
// scanning its import declarations for the first non-framework import that
// resolves to an existing file in the repo.
function resolveSourceFileFromTest(testFilePath) {
  const content = readFileSync(testFilePath, 'utf8');
  const testDir = dirname(testFilePath);

  // Match both `import ... from '...'` and `require('...')`
  const importRe = /from ['"]([^'"]+)['"]/g;
  let m;
  const candidates = [];
  while ((m = importRe.exec(content)) !== null) {
    candidates.push(m[1]);
  }

  // Skip framework/library imports (no relative path prefix).
  const relCandidates = candidates.filter(c => c.startsWith('.'));

  for (const rel of relCandidates) {
    // Try common extensions in priority order.
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const abs = resolve(testDir, rel + ext);
      if (existsSync(abs)) {
        // Convert absolute path back to repo-root-relative.
        const repoRoot = process.cwd();
        const repoRel = abs.startsWith(repoRoot + '/') ? abs.slice(repoRoot.length + 1) : abs;
        // Skip if the resolved path is itself a test/spec file.
        if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(repoRel)) continue;
        return repoRel;
      }
    }
    // Also try index files.
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const abs = resolve(testDir, rel, 'index' + ext);
      if (existsSync(abs)) {
        const repoRoot = process.cwd();
        const repoRel = abs.startsWith(repoRoot + '/') ? abs.slice(repoRoot.length + 1) : abs;
        return repoRel;
      }
    }
  }
  return null;
}

// Extract just the failing "●" block(s) from the log — these are the most
// actionable excerpt to send to the model (reduces noise, saves context).
function extractFailureBlocks(logText) {
  const lines = logText.split('\n');
  const blocks = [];
  let inBlock = false;
  let block = [];

  for (const line of lines) {
    if (/^\s+●\s+/.test(line) || /^●\s+/.test(line)) {
      if (block.length > 0) blocks.push(block.join('\n'));
      block = [line];
      inBlock = true;
    } else if (inBlock) {
      // A blank line after another blank line with no indent = end of block.
      if (line.trim() === '' && block.at(-1)?.trim() === '') {
        blocks.push(block.join('\n'));
        block = [];
        inBlock = false;
      } else {
        block.push(line);
      }
    }
  }
  if (block.length > 0) blocks.push(block.join('\n'));

  // Return first two blocks — enough context without overloading the model.
  return blocks.slice(0, 2).join('\n\n');
}

let testDiagnosis = null;

if (!diagnosis.confident) {
  console.log('Phase 1 not confident — checking for test failures (Phase 1b)...');

  // Debug: show the first 500 chars of the cleaned log so we can see what
  // patterns are (or aren't) present when Phase 1b triggers.
  console.log('--- cleaned log sample (first 500 chars) ---');
  console.log(cleanLog.slice(0, 500));
  console.log('--- end sample ---');

  // If Phase 1 already identified a test file path (confident=false but file
  // is set and exists), use it directly rather than requiring a ● block in
  // the log. The model correctly parsed the failure; we just need to proceed.
  let testFilePath = null;
  const phase1File = diagnosis.file ?? '';
  if (phase1File && existsSync(phase1File) && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(phase1File)) {
    console.log(`Phase 1b: using test file from Phase 1 diagnosis → ${phase1File}`);
    testFilePath = phase1File;
  } else {
    testFilePath = extractTestFailureContext(cleanLog);
  }

  if (!testFilePath) {
    failClean('Phase 1 not confident and no recognisable test failure block found in log');
  }

  console.log(`Phase 1b: test file identified → ${testFilePath}`);

  const sourceFilePath = resolveSourceFileFromTest(testFilePath);
  if (!sourceFilePath) {
    failClean(`Phase 1b: could not resolve a source file from test imports in ${testFilePath}`);
  }

  console.log(`Phase 1b: source file identified → ${sourceFilePath}`);

  const testContent   = truncate(readFileSync(testFilePath, 'utf8'),   MAX_SOURCE_CHARS);
  const sourceContent = truncate(readFileSync(sourceFilePath, 'utf8'), MAX_SOURCE_CHARS);
  const failureBlocks = extractFailureBlocks(cleanLog) || truncate(cleanLog, 3_000);

  const phase1bSystem = `You are a senior engineer fixing a failing test in a TypeScript monorepo
(NestJS backend, React/Vite frontend).

You will be given:
1. The failure output from Jest/Vitest.
2. The test file that is failing.
3. The source file the test is exercising.

Your job is to identify the EXACT LINE(S) in the SOURCE FILE that need to change
to make the test pass. You may only suggest deleting lines or replacing a single
contiguous block of lines with new content.

Respond with a JSON object matching this schema exactly:
{
  "confident": boolean,
  "file": "repo-root-relative path to the SOURCE file (not the test file)",
  "edit_type": "delete" | "replace",
  "lines_to_delete": [1-based line numbers to remove; for replace, these are the lines being replaced],
  "replacement_lines": ["line 1 content", "line 2 content"],
  "summary": "one sentence: what the test expects and what the source does wrong",
  "explanation": "one sentence: what the edit fixes"
}

Rules:
- Set "confident": true ONLY if you can point to a specific, small (≤10 lines)
  change in the source file that would make the failing assertion pass.
- For "delete": set "replacement_lines" to [].
- For "replace": "lines_to_delete" contains the lines being replaced;
  "replacement_lines" contains the new content (preserve indentation exactly).
- Never target the test file itself — fix the source.
- If the test is wrong (not the source), or the fix requires more than 10 lines
  to change, set "confident": false.
- Preserve existing indentation and code style exactly.`;

  const phase1bUser = `Failure output:
\`\`\`
${failureBlocks}
\`\`\`

Test file (${testFilePath}):
\`\`\`typescript
${testContent}
\`\`\`

Source file (${sourceFilePath}):
\`\`\`typescript
${sourceContent}
\`\`\``;

  try {
    const text = await callOllama(
      [{ role: 'system', content: phase1bSystem }, { role: 'user', content: phase1bUser }],
      {
        type: 'object',
        properties: {
          confident:         { type: 'boolean' },
          file:              { type: 'string' },
          edit_type:         { type: 'string', enum: ['delete', 'replace'] },
          lines_to_delete:   { type: 'array', items: { type: 'number' } },
          replacement_lines: { type: 'array', items: { type: 'string' } },
          summary:           { type: 'string' },
          explanation:       { type: 'string' },
        },
        required: ['confident', 'file', 'edit_type', 'lines_to_delete', 'replacement_lines', 'summary', 'explanation'],
      },
    );
    console.log('--- phase 1b diagnosis ---');
    console.log(text);
    console.log('--- end phase 1b ---');
    testDiagnosis = JSON.parse(text);
  } catch (err) {
    failClean(`Phase 1b LLM call failed: ${err.message}`);
  }

  console.log(`phase1b: confident=${testDiagnosis.confident} file=${testDiagnosis.file} edit=${testDiagnosis.edit_type} lines=${JSON.stringify(testDiagnosis.lines_to_delete)}`);

  if (!testDiagnosis.confident)   failClean('Phase 1b: model was not confident enough to propose a fix');
  if (!testDiagnosis.file)        failClean('Phase 1b: model did not identify a target file');
  if (!Array.isArray(testDiagnosis.lines_to_delete) || testDiagnosis.lines_to_delete.length === 0) {
    failClean('Phase 1b: model did not identify lines to edit');
  }

  // Promote testDiagnosis fields into the shared diagnosis shape so Phase 2
  // can operate uniformly regardless of which phase produced the diagnosis.
  diagnosis = {
    confident:       true,
    file:            testDiagnosis.file,
    lines_to_delete: testDiagnosis.lines_to_delete,
    edit_type:       testDiagnosis.edit_type,
    replacement_lines: testDiagnosis.replacement_lines ?? [],
    summary:         testDiagnosis.summary,
    explanation:     testDiagnosis.explanation,
  };
}

// Phase 1 compiler path: normalise missing fields to defaults.
diagnosis.edit_type         ??= 'delete';
diagnosis.replacement_lines ??= [];

// ---------------------------------------------------------------------------
// Phase 2: mechanically apply the identified edit and produce a real diff.
// The model never touches diff syntax — we generate it from git.
// ---------------------------------------------------------------------------

if (!existsSync(diagnosis.file)) {
  failClean(`identified file does not exist in workspace: ${diagnosis.file}`);
}

const fileLines = readFileSync(diagnosis.file, 'utf8').split('\n');
const toEdit    = new Set(diagnosis.lines_to_delete.map(Number));
const maxLine   = Math.max(...toEdit);

if (maxLine > fileLines.length) {
  failClean(`line ${maxLine} is out of range (file has ${fileLines.length} lines)`);
}

// Safety check for deletes only: refuse to delete structural scaffolding.
// Replaces bypass this check — the model supplied the replacement content.
const UNSAFE_PATTERNS = /^\s*(export|import|function|class|interface|type\s+\w|const\s+\w.*=>|@)/;
if (diagnosis.edit_type === 'delete') {
  for (const lineNum of toEdit) {
    const content = fileLines[lineNum - 1] ?? '';
    if (UNSAFE_PATTERNS.test(content)) {
      failClean(`line ${lineNum} looks like structural code ("${content.trim()}") — refusing to delete`);
    }
  }
}

// Apply the edit.
let patched;
if (diagnosis.edit_type === 'replace') {
  // Replace the contiguous block of lines_to_delete with replacement_lines.
  // lines_to_delete may be non-contiguous in theory, but we treat the span
  // from min→max as the replacement region (safe for the ≤10 line constraint).
  const minLine = Math.min(...toEdit);
  patched = [
    ...fileLines.slice(0, minLine - 1),
    ...diagnosis.replacement_lines,
    ...fileLines.slice(maxLine),
  ].join('\n');
} else {
  // Delete: filter out every line whose 1-based index is in toEdit.
  patched = fileLines.filter((_, idx) => !toEdit.has(idx + 1)).join('\n');
}

writeFileSync(diagnosis.file, patched, 'utf8');

// Generate the diff from git's own comparison — guaranteed to be valid.
let diff;
try {
  diff = execSync(`git diff -- ${diagnosis.file}`, { encoding: 'utf8' });
} catch (_) {
  diff = '';
}

if (!diff.trim()) failClean('file was unchanged after applying the edit — nothing to commit');

writeFileSync(`${OUT_DIR}/patch.diff`, diff);
console.log('Patch applied. Diff:');
console.log(diff);

// ---------------------------------------------------------------------------
// Write PR metadata
// ---------------------------------------------------------------------------

const phaseLabel    = testDiagnosis ? 'test-failure analysis (Phase 1b)' : 'compiler/lint analysis (Phase 1)';
const editDesc      = diagnosis.edit_type === 'replace'
  ? `Replaced line(s) ${diagnosis.lines_to_delete.join(', ')} in \`${diagnosis.file}\`.`
  : `Deleted line(s) ${diagnosis.lines_to_delete.join(', ')} from \`${diagnosis.file}\`.`;
const logExcerpt    = log.split('\n').filter(l => l.trim()).slice(-20).join('\n');

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

${editDesc}

<sub>Diagnosed via ${phaseLabel}</sub>

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
