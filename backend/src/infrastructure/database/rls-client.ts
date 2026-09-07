import { Client } from 'pg';
import type { ClientBase } from 'pg';

import { requestContext } from '../logger/request-id.middleware';

/** Session GUC every RLS policy reads. Must match the policy migration. */
export const RLS_GUC = 'app.current_user_id';

/**
 * Statements that must not be preceded by the tenant stamp.
 *
 * Injecting a statement before BEGIN would open an implicit transaction that
 * the following COMMIT then closes, desynchronising TypeORM's own transaction
 * bookkeeping. Nothing is lost by skipping them: the connection already carries
 * the right tenant (the query before it set it), and the first real statement
 * inside the transaction stamps it again.
 */
const TX_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|START\s+TRANSACTION)\b/i;

function statementText(config: unknown): string {
  if (typeof config === 'string') return config;
  if (typeof config === 'object' && config !== null && 'text' in config) {
    const { text } = config as { text: unknown };
    if (typeof text === 'string') return text;
  }
  return '';
}

/**
 * A pg Client that stamps the current tenant onto its session before every
 * statement (NFR-038).
 *
 * Installed through TypeORM's `extra.Client`, which the postgres driver spreads
 * into the pg.Pool config and pg-pool passes to `new this.Client(options)`.
 *
 * Overriding query() rather than connect()/release() is deliberate. pg-pool has
 * no hook that fires on every checkout — warm checkouts pop straight off the
 * idle list — so a checkout-time SET would silently miss connections. And a
 * release-time RESET leaks whenever release never runs: a client that errors or
 * is evicted is returned to no one and reset by nothing.
 *
 * Stamping before *every* statement instead makes a leak structurally
 * impossible. Whatever the previous borrower left behind is overwritten before
 * this borrower's first real query, so a connection can never be read under an
 * identity that is not the caller's.
 *
 * With no tenant in context the GUC is set to the empty string, which the
 * policies turn into NULL via NULLIF — zero rows, never all rows. Requests that
 * legitimately run without a tenant (login, register, health) use the
 * privileged pool, which installs no such Client.
 */
export class RlsClient extends Client {
  private async stampTenant(): Promise<void> {
    const userId = requestContext.getStore()?.userId ?? '';
    // set_config() is an ordinary function call, so the value binds as $2.
    // SET LOCAL cannot be parameterised and would mean concatenating a value
    // into SQL. is_local=false because the identity has to outlive statements
    // issued outside any transaction.
    await super.query('SELECT set_config($1, $2, false)', [RLS_GUC, userId]);
  }

  /*
   * pg declares query() with eight overloads, including a Submittable stream
   * form. Re-declaring that surface would add no safety, since the arguments
   * are forwarded untouched — so the property borrows the base class's own
   * type verbatim and the implementation works in `unknown`.
   */
  override query: Client['query'] = ((...args: unknown[]): unknown => {
    const forward = (): unknown =>
      (Client.prototype.query as (...a: unknown[]) => unknown).apply(this, args);

    const [config, , third] = args;

    // Callback style is used by pg's internals (keepalives); TypeORM never
    // uses it. Stamping there would mean threading the callback through an
    // extra promise for no benefit.
    if (typeof third === 'function' || TX_CONTROL.test(statementText(config))) {
      return forward();
    }

    return this.stampTenant().then(forward);
  }) as unknown as Client['query'];
}

/**
 * `extra.Client` is typed `new () => ClientBase` in @types/pg, which does not
 * describe pg's real `constructor(config)`. Narrow once here rather than
 * casting wherever the pool is configured.
 */
export const RLS_CLIENT_CTOR = RlsClient as unknown as new () => ClientBase;
