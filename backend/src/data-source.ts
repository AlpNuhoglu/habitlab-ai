import 'reflect-metadata';

import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: '.env.local' });
dotenv.config();

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
