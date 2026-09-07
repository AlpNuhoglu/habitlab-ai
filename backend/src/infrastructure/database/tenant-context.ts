import { randomUUID } from 'crypto';

import { requestContext } from '../logger/request-id.middleware';

/**
 * Runs `fn` as a given tenant, so tenant-scoped repositories reached from a
 * background worker resolve the same way they would inside a request (NFR-038).
 *
 * Workers have no HTTP request and therefore no ambient tenant, but they are
 * not doing anything cross-tenant when they act on one user's event: the
 * notification scheduler processes one habit for one user, the recommendation
 * worker evaluates one user's analytics. Those paths reach user-scoped
 * repositories, which live on the RLS-bound pool and would otherwise see no
 * tenant and return nothing.
 *
 * The alternative — moving those repositories to the privileged pool — would
 * hand a permanent RLS bypass to code that only ever needs one tenant at a
 * time. Establishing the tenant is both narrower and truer to what the worker
 * is actually doing.
 *
 * The userId must come from data the worker already trusts (an event payload,
 * a row it just read), never from anything user-supplied.
 */
export function runAsTenant<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const existing = requestContext.getStore();
  if (existing) {
    // Already inside a context (a worker invoked from a request, or a test).
    // Mutating it rather than nesting keeps a single source of truth for the
    // tenant, and the caller restores it below.
    const previous = existing.userId;
    existing.userId = userId;
    return fn().finally(() => {
      // Under exactOptionalPropertyTypes an absent tenant is the property being
      // absent, not set to undefined.
      if (previous === undefined) delete existing.userId;
      else existing.userId = previous;
    });
  }

  return requestContext.run({ requestId: `worker-${randomUUID()}`, userId }, fn);
}
