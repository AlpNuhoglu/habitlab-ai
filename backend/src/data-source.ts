import 'reflect-metadata';

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

// __dirname is backend/src (ts-node) or backend/dist (compiled).
// Going up two levels in both cases reaches the monorepo root where .env lives.
const root = resolve(__dirname, '../..');
dotenv.config({ path: resolve(root, '.env.local') });
dotenv.config({ path: resolve(root, '.env') });

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL env var is not set');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env['NODE_ENV'] !== 'production',
});
