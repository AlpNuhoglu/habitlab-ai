#!/usr/bin/env node
// AI PR Reviewer — posts structured Markdown review feedback as a PR comment.
//
// Design principles (mirrors ai-diagnose-and-patch.mjs):
//   - Fail-closed: any unrecoverable error posts a "review skipped" comment
//     rather than silently doing nothing. The PR author always sees an outcome.
//   - Diff size guard: diffs exceeding MAX_DIFF_CHARS get a polite skip comment
//     instead of blowing up the LLM context window.
//   - JSON schema enforcement: Ollama's structured-output format field is used
//     (not prompt-only instructions) so the model cannot produce unparseable
//     output regardless of temperature drift.
//   - No shell interpolation of diff content: the diff is read from a file and
//     passed as a JS string — never interpolated into a shell command.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MAX_DIFF_CHARS     = 15_000;
const REQUEST_TIMEOUT_MS = 120_000;
const MODEL    = process.env.OLLAMA_MODEL    || 'llama3';
const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');

const PR_NUMBER  = process.env.PR_NUMBER;
const PR_TITLE   = process.env.PR_TITLE   || '(untitled)';
const PR_AUTHOR  = process.env.PR_AUTHOR  || 'unknown';
const DIFF_PATH  = process.env.DIFF_PATH;
const DIFF_CHARS = parseInt(process.env.DIFF_CHARS ?? '0', 10);
const REPO       = process.env.REPO;
const GH_TOKEN   = process.env.GH_TOKEN;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Post a Markdown comment on the PR via `gh pr comment`. Never throws. */
function postComment(body) {
  try {
    execFileSync('gh', ['pr', 'comment', PR_NUMBER, '--repo', REPO, '--body', body], {
      env: { ...process.env, GH_TOKEN },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (err) {
    // Posting the comment itself failed — log but don't crash the job.
    console.error(`Failed to post PR comment: ${err.message}`);
  }
}

/**
 * Exit cleanly after posting a visible "review skipped" comment so the PR
 * author always sees an outcome, even when the reviewer cannot complete.
 */
function skipClean(reason, detail = '') {
  console.log(`Review skipped: ${reason}`);
  const body = [
    `## 🤖 AI Code Review`,
    ``,
    `> **Review skipped** — ${reason}`,
    detail ? `\n> ${detail}` : '',
    ``,
    `<sub>Powered by \`${MODEL}\` · [ai-pr-reviewer](.github/workflows/ai-pr-reviewer.yml)</sub>`,
  ].join('\n');
  postComment(body);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------
if (!process.env.OLLAMA_BASE_URL) {
  skipClean('`OLLAMA_BASE_URL` repository variable is not configured.');
}
if (!PR_NUMBER || !REPO || !GH_TOKEN) {
  skipClean('Required environment variables (PR_NUMBER, REPO, GH_TOKEN) are missing.');
}

// ---------------------------------------------------------------------------
// Diff size guard
// ---------------------------------------------------------------------------
if (DIFF_CHARS > MAX_DIFF_CHARS) {
  skipClean(
    `Diff is too large to review automatically (${DIFF_CHARS.toLocaleString()} chars > ${MAX_DIFF_CHARS.toLocaleString()} limit).`,
    'Please request a manual review for this PR.',
  );
}

const diff = readFileSync(DIFF_PATH, 'utf8').trim();

if (!diff) {
  skipClean('The PR diff is empty — nothing to review.');
}

// ---------------------------------------------------------------------------
// System and user prompts
// ---------------------------------------------------------------------------
const systemPrompt = `You are a Senior Software Engineer conducting a thorough Pull Request review.
Your audience is the PR author — be constructive, specific, and respectful.

Review the unified diff provided and evaluate it across three dimensions:
1. **Bugs & edge cases** — logic errors, off-by-one errors, unhandled nulls/undefineds,
   missing error handling, race conditions, incorrect async/await usage.
2. **React & Node.js patterns** — missing dependency arrays in useEffect/useCallback/useMemo,
   unnecessary re-renders, blocking the event loop, N+1 queries, mutating state directly,
   missing cleanup in useEffect, improper error boundaries.
3. **Readability & maintainability** — unclear naming, duplicated logic that could be
   extracted, overly complex conditionals, missing types in TypeScript, magic numbers.

Respond with a JSON object matching this schema exactly — no extra keys, no markdown fences:
{
  "looks_good": boolean,
  "summary": "2–4 sentence overall assessment of the changes",
  "feedback_points": ["specific actionable point", "..."]
}

Rules:
- "looks_good": true only when there are NO blocking issues (minor style nits are fine).
- "feedback_points": 0–6 items. Each point must reference a specific file/line or pattern
  from the diff. Omit generic advice not grounded in the actual diff.
- If the diff contains only documentation, lock files, or config changes with no logic,
  set "looks_good": true and "feedback_points": [].
- Never invent issues not present in the diff.
- Write every feedback point as an actionable suggestion, not just an observation.`;

const userPrompt = `PR #${PR_NUMBER}: "${PR_TITLE}" (by @${PR_AUTHOR})

Diff:

${diff}`;

// ---------------------------------------------------------------------------
// Call Ollama
// ---------------------------------------------------------------------------
let review;
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
        // Enforce the JSON schema at the Ollama layer — the model cannot
        // produce structurally invalid output regardless of its temperature.
        format: {
          type: 'object',
          properties: {
            looks_good:      { type: 'boolean' },
            summary:         { type: 'string' },
            feedback_points: { type: 'array', items: { type: 'string' } },
          },
          required: ['looks_good', 'summary', 'feedback_points'],
        },
        stream: false,
        options: { temperature: 0.1 },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${body}`);
  }

  const completion = await res.json();
  const text = completion?.message?.content?.trim() ?? '';
  console.log('--- model review ---');
  console.log(text);
  console.log('--- end review ---');

  review = JSON.parse(text);
} catch (err) {
  skipClean(`LLM call failed — ${err.message}`);
}

// ---------------------------------------------------------------------------
// Validate the parsed response
// ---------------------------------------------------------------------------
if (typeof review.looks_good !== 'boolean' || typeof review.summary !== 'string') {
  skipClean('Model returned an unexpected response shape — cannot format review.');
}

const feedbackPoints = Array.isArray(review.feedback_points) ? review.feedback_points : [];

// ---------------------------------------------------------------------------
// Build the Markdown comment
// ---------------------------------------------------------------------------
const statusLine = review.looks_good
  ? '✅ **Looks good!** No blocking issues found.'
  : '⚠️ **Some issues found.** Please review the points below before merging.';

const feedbackSection = feedbackPoints.length > 0
  ? [
      '',
      '### Feedback',
      '',
      ...feedbackPoints.map(point => `- ${point}`),
    ].join('\n')
  : '';

// Positive-only comment when looks_good and no nits.
const encouragement = (review.looks_good && feedbackPoints.length === 0)
  ? '\n\nGreat work — this PR is clean and well-structured. Ship it! 🚀'
  : '';

const comment = [
  `## 🤖 AI Code Review`,
  ``,
  statusLine,
  ``,
  `### Summary`,
  ``,
  review.summary,
  feedbackSection,
  encouragement,
  ``,
  `<sub>Reviewed by \`${MODEL}\` · ${DIFF_CHARS.toLocaleString()} chars of diff · [ai-pr-reviewer](.github/workflows/ai-pr-reviewer.yml)</sub>`,
].join('\n');

// ---------------------------------------------------------------------------
// Post the comment
// ---------------------------------------------------------------------------
postComment(comment);
console.log('Review comment posted successfully.');
