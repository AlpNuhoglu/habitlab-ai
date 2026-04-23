-- Run on container first-boot. Creates the extensions the app schema depends on.
-- The application schema (tables, indexes, triggers) lives in backend migrations —
-- this file ONLY bootstraps what the Postgres superuser needs to add.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- The habitlab role already owns the database (set via POSTGRES_USER),
-- so no additional GRANTs are needed at this stage. The migration runner
-- will create tables as that same role.
