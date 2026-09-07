import { Client } from 'pg';

import { requestContext } from '../logger/request-id.middleware';
import { RLS_GUC, RlsClient } from './rls-client';

/**
 * Records what reaches pg by stubbing the base class, so the tests observe the
 * exact statement sequence a real connection would see.
 */
type Call = { text: string; values?: unknown[] };

function makeClient(): { client: RlsClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = new RlsClient();

  jest
    .spyOn(Client.prototype, 'query')
    .mockImplementation(((text: unknown, values?: unknown[]) => {
      calls.push({
        text: typeof text === 'string' ? text : String((text as { text: string }).text),
        ...(values !== undefined ? { values } : {}),
      });
      return Promise.resolve({ rows: [] });
    }) as unknown as typeof Client.prototype.query);

  return { client, calls };
}

function run<T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const store = userId === undefined ? { requestId: 'r' } : { requestId: 'r', userId };
  return requestContext.run(store, fn);
}

describe('RlsClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stamps the tenant from request context before the statement', async () => {
    const { client, calls } = makeClient();

    await run('user-a', () => client.query('SELECT 1') as Promise<unknown>);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      text: 'SELECT set_config($1, $2, false)',
      values: [RLS_GUC, 'user-a'],
    });
    expect(calls[1]?.text).toBe('SELECT 1');
  });

  // The critical one: an empty tenant must reach the database as '', which the
  // policies turn into NULL. Skipping the stamp would leave whatever the last
  // borrower of this pooled connection set.
  it('stamps an empty tenant when no request context is active', async () => {
    const { client, calls } = makeClient();

    await (client.query('SELECT 1') as Promise<unknown>);

    expect(calls[0]?.values).toEqual([RLS_GUC, '']);
  });

  it('stamps an empty tenant when the context has no userId', async () => {
    const { client, calls } = makeClient();

    await run(undefined, () => client.query('SELECT 1') as Promise<unknown>);

    expect(calls[0]?.values).toEqual([RLS_GUC, '']);
  });

  it.each(['BEGIN', 'COMMIT', 'ROLLBACK', '  begin  ', 'SAVEPOINT s1'])(
    'does not stamp before transaction control (%s)',
    async (sql) => {
      const { client, calls } = makeClient();

      await run('user-a', () => client.query(sql) as Promise<unknown>);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.text).toBe(sql);
    },
  );

  it('re-stamps on every statement so a reused connection cannot inherit a tenant', async () => {
    const { client, calls } = makeClient();

    await run('user-a', () => client.query('SELECT 1') as Promise<unknown>);
    await run('user-b', () => client.query('SELECT 2') as Promise<unknown>);

    expect(calls.map((c) => c.values?.[1]).filter(Boolean)).toEqual(['user-a', 'user-b']);
  });

  it('stamps queries passed as a config object', async () => {
    const { client, calls } = makeClient();

    await run('user-a', () =>
      client.query({ text: 'SELECT $1', values: [1] }) as Promise<unknown>);

    expect(calls[0]?.values).toEqual([RLS_GUC, 'user-a']);
    expect(calls[1]?.text).toBe('SELECT $1');
  });
});
