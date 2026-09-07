import type { DataSource } from 'typeorm';

interface RoleRow {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

/**
 * Refuses to start if the application pool connects as a role that bypasses row
 * level security (NFR-038).
 *
 * A superuser ignores policies unconditionally, and a table owner ignores them
 * unless FORCE is set. Either way the policies would still be listed by \d+
 * while enforcing nothing, so the failure is invisible exactly when it matters.
 * Booting into that state is worse than running with no RLS at all, because
 * everything downstream — the cross-tenant tests, the CI scoping check, code
 * review — would be reading a guarantee that is not there.
 *
 * Deliberately not gated on NODE_ENV: if this ever regresses in CI or test, that
 * is precisely when it should be caught.
 */
export async function assertRlsRole(dataSource: DataSource): Promise<void> {
  const rows = await dataSource.query<RoleRow[]>(
    `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
  );

  const role = rows[0];
  if (!role) {
    throw new Error('Could not determine the current database role; refusing to start.');
  }

  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `Application pool is connected as '${role.rolname}', which bypasses row level ` +
        `security (rolsuper=${role.rolsuper}, rolbypassrls=${role.rolbypassrls}). ` +
        `Policies would be present but unenforced. Set APP_DATABASE_URL to the ` +
        `habitlab_app role — if that role does not exist yet, run migrations with ` +
        `APP_DB_PASSWORD set.`,
    );
  }
}
