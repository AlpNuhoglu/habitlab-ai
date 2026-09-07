import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { DataSource } from 'typeorm';

import { AppModule } from './app.module';
import { assertRlsRole } from './infrastructure/database/assert-rls-role';
import { AppLoggerService } from './infrastructure/logger/app-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Before serving a single request: prove the pool cannot bypass RLS.
  await assertRlsRole(app.get(DataSource));

  // Behind a reverse proxy (nginx, Fly, etc.) the client IP is in
  // X-Forwarded-For. Trust the first proxy hop so rate limiting keys on the
  // real client IP instead of lumping everyone under the proxy's address.
  app.set('trust proxy', 1);

  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics', 'api/docs'] });

  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // CORS for the SPA in local dev. Tighten for production.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  // OpenAPI spec for the frontend to generate types from. See CONTRIBUTING.md.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HabitLab AI API')
    .setDescription('REST API for HabitLab AI. See docs/HabitLab_AI_Analysis_Report.docx §6.1.')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`HabitLab AI backend listening on http://localhost:${port}`, 'Bootstrap');
  logger.log(`OpenAPI docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});

