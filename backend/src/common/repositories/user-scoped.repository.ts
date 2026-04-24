import type { Repository } from 'typeorm';

/**
 * Contract for all user-data repositories.
 * Every public method must accept a userId parameter and filter by it.
 * TypeScript enforces this at compile time; there is no runtime interceptor.
 * Violation: a method that returns rows without a userId filter breaks NFR-038.
 */
export abstract class UserScopedRepository<T extends object> {
  protected abstract readonly repo: Repository<T>;
}
