import type { INestApplication } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { PRIVILEGED_DATA_SOURCE } from '../../src/infrastructure/database/database.tokens';

/**
 * The DataSource e2e suites should use for raw setup and verification queries.
 *
 * These queries run outside any HTTP request, so there is no tenant in the
 * ambient context — on the application pool RLS would return zero rows and the
 * assertions would fail for a reason that has nothing to do with the behaviour
 * under test. Worse, in `cross-tenant.e2e-spec.ts` the whole point of several
 * queries is to read *another* tenant's row and prove the attacker did not
 * change it; that read is only possible from a pool that is not tenant-scoped.
 *
 * This is the measuring instrument, not the thing being measured. Assertions
 * about isolation still go through HTTP, where the application's own filters
 * and RLS both apply.
 */
export function privilegedDataSource(app: INestApplication): DataSource {
  return app.get<DataSource>(PRIVILEGED_DATA_SOURCE);
}
