#!/usr/bin/env node
/**
 * Fails the build when a SQL query against a user-owned table does not filter by
 * user_id (NFR-038).
 *
 * PostgreSQL RLS now backs these filters (NFR-038), but this check still earns
 * its place: it catches a missing filter in CI, in seconds, on the diff that
 * introduces it. RLS catches the same mistake at runtime by returning nothing,
 * which reads as an empty dashboard rather than an error and can take a long
 * time to trace back. Cheaper and earlier here.
 *
 * Scope: raw SQL string literals in backend/src (the `dataSource.query()` /
 * `em.query()` style). TypeORM finder calls (`repo.findOne({ where: ... })`) are
 * not parsed here -- they are covered by review and by the cross-tenant e2e
 * suite, since matching object literals reliably needs a real TS parser.
 *
 * Usage: node scripts/check-query-scoping.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(BACKEND_ROOT, 'src');

/** Tables that carry a user_id column and hold per-user rows. */
const USER_OWNED_TABLES = [
  'habits',
  'habit_logs',
  'habit_analytics',
  'user_analytics',
  'chat_messages',
  'recommendations',
  'push_subscriptions',
  'notifications_sent',
  'experiment_assignments',
  'refresh_tokens',
  'events',
  'audit_log',
];

/**
 * Queries that legitimately touch a user-owned table without a user_id filter.
 * Every entry needs a reason. Keyed by "<path>:<line of the query literal>".
 *
 * Adding an entry is a deliberate act: it asserts the query is safe despite not
 * naming user_id. Prefer adding the filter over adding a line here.
 */
const ALLOWLIST = new Map([
  [
    'src/modules/events/outbox-publisher.service.ts:145',
    'Marks already-fetched events published by primary key. The outbox drains every tenant by design and the ids come from the rows this transaction just read.',
  ],
]);

/** Strip line and block comments so commented-out SQL never trips the check. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(
    /\/\/[^\n]*/g,
    '',
  );
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'migrations') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

const SQL_VERB = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;

/** Pull out every backtick template literal along with the line it starts on. */
function extractTemplateLiterals(source) {
  const literals = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '`') continue;
    const start = i;
    i++;
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '\\') i++;
      i++;
    }
    const body = source.slice(start + 1, i);
    if (SQL_VERB.test(body)) {
      literals.push({ body, line: source.slice(0, start).split('\n').length });
    }
  }
  return literals;
}

const violations = [];
const usedAllowlistKeys = new Set();

for (const file of walk(SRC)) {
  const rel = relative(BACKEND_ROOT, file);
  const source = stripComments(readFileSync(file, 'utf8'));

  for (const { body, line } of extractTemplateLiterals(source)) {
    const touched = USER_OWNED_TABLES.filter((t) =>
      new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+${t}\\b`, 'i').test(body),
    );
    if (touched.length === 0) continue;
    if (/\buser_id\b/i.test(body)) continue;

    const key = `${rel}:${line}`;
    if (ALLOWLIST.has(key)) {
      usedAllowlistKeys.add(key);
      continue;
    }

    violations.push({
      key,
      tables: touched.join(', '),
      snippet: body.trim().split('\n').slice(0, 3).join(' ').replace(/\s+/g, ' ').slice(0, 140),
    });
  }
}

let failed = false;

if (violations.length > 0) {
  failed = true;
  console.error('\nERROR: query against a user-owned table without a user_id filter:\n');
  for (const v of violations) {
    console.error(`  ${v.key}  [${v.tables}]`);
    console.error(`    ${v.snippet}\n`);
  }
  console.error('Add "WHERE user_id = $n" (pair it with the row id on single-row lookups).');
  console.error('If the query is genuinely cross-tenant, add it to ALLOWLIST with a reason.\n');
}

// A stale allowlist entry means the code moved. Fail rather than let an
// exemption silently drift onto a different query.
const stale = [...ALLOWLIST.keys()].filter((k) => !usedAllowlistKeys.has(k));
if (stale.length > 0) {
  failed = true;
  console.error('\nERROR: stale ALLOWLIST entries in scripts/check-query-scoping.mjs:\n');
  for (const k of stale) console.error(`  ${k}`);
  console.error('\nThe query moved or was changed. Re-verify it is still safe, then update the line number.\n');
}

if (failed) process.exit(1);

console.log(
  `Query scoping check passed (${ALLOWLIST.size} documented cross-tenant exception${ALLOWLIST.size === 1 ? '' : 's'}).`,
);
