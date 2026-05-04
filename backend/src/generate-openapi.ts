/**
 * Standalone script — generates backend/openapi.json.
 * Requires a running Postgres at DATABASE_URL (run `pnpm db:up` first).
 *
 *   pnpm --filter backend generate:openapi
 */
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready', 'metrics', 'api/docs'],
  });

  const config = new DocumentBuilder()
    .setTitle('HabitLab AI API')
    .setDescription('REST API for HabitLab AI. See docs/HabitLab_AI_Analysis_Report.docx §6.1.')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  const outPath = resolve(__dirname, '../../openapi.json');
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
  process.exit(0);
}

generate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('generate-openapi failed:', err);
  process.exit(1);
});
