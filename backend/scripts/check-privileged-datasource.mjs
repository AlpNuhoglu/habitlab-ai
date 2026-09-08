#!/usr/bin/env node
/**
 * Fails the build when code outside the allowlist reaches for the connection
 * pool that bypasses row level security (NFR-038).
 *
 * RLS only isolates tenants for code that goes through the application pool.
 * PRIVILEGED_DATA_SOURCE opts out of that entirely, which is correct for the
 * handful of subsystems that genuinely span tenants and wrong everywhere else.
 * Nothing in the type system distinguishes the two — both are a DataSource — so
 * the boundary is held here instead.
 *
 * Adding an entry is a deliberate act. Before doing it, check whether the code
 * actually needs every tenant or just one: a worker acting on a single user's
 * event should call runAsTenant() and stay on the application pool.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const TOKEN = 'PRIVILEGED_DATA_SOURCE';

/** Each entry states why this file is allowed to cross tenant boundaries. */
const ALLOWLIST = new Map([
  [
    'src/infrastructure/database/database.tokens.ts',
    'Defines the token.',
  ],
  [
    'src/infrastructure/database/database.module.ts',
    'Provides the pool.',
  ],
  [
    'src/modules/events/outbox-publisher.service.ts',
    'Drains unpublished events for every tenant and runs ensure_events_partition.',
  ],
  [
    'src/modules/notifications/notification-scheduler.service.ts',
    'Scans habits joined to users across every tenant to find what is due; per-habit work runs under runAsTenant.',
  ],
  [
    'src/infrastructure/audit/audit.service.ts',
    'Append-only writes with a nullable user_id, issued fire-and-forget after the request context may have unwound.',
  ],
  [
    'src/modules/auth/auth.service.ts',
    'Register, login, verify, refresh and reset all run before a tenant exists.',
  ],
  [
    'src/modules/auth/repositories/refresh-token.repository.ts',
    'findByHash reads without a user_id so token reuse is detectable (FR-004); refresh_tokens is ungranted to the app role.',
  ],
  [
    'src/common/health.controller.ts',
    'Readiness probes the database itself and runs with no request identity.',
  ],
  [
    'src/cli/cli.ts',
    'Operator tooling: experiment:analyze aggregates across tenants and a CLI process has no request identity.',
  ],
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
const seen = new Set();

for (const file of walk(SRC)) {
  const rel = relative(resolve(SRC, '..', '..'), file).replace(/\\/g, '/');
  const key = rel.startsWith('backend/') ? rel.slice('backend/'.length) : rel;

  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = lines
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes(TOKEN));

  if (hits.length === 0) continue;

  if (ALLOWLIST.has(key)) {
    seen.add(key);
    continue;
  }

  for (const { n } of hits) violations.push(`${key}:${n}`);
}

// A stale entry means the file stopped using the token — the exemption should
// go with it, rather than sitting there ready to cover unrelated future code.
const stale = [...ALLOWLIST.keys()].filter((k) => !seen.has(k));

if (violations.length > 0) {
  console.error('\nERROR: unapproved use of the RLS-bypassing DataSource:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    '\nThis pool is not subject to row level security. If the code needs one\n' +
      "tenant rather than every tenant, use the default DataSource and wrap the\n" +
      'work in runAsTenant(). If it genuinely spans tenants, add it to ALLOWLIST\n' +
      `in ${relative(process.cwd(), fileURLToPath(import.meta.url))} with a reason.\n`,
  );
  process.exit(1);
}

if (stale.length > 0) {
  console.error('\nERROR: stale allowlist entries (the file no longer uses the token):\n');
  for (const s of stale) console.error(`  ${s}`);
  console.error('\nRemove them so the exemption does not outlive the code it covered.\n');
  process.exit(1);
}

console.log(
  `Privileged DataSource check passed (${ALLOWLIST.size} documented cross-tenant consumers).`,
);
