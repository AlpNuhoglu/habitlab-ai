import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Structured logging is wired up in AppModule via nest-winston.
    // Default logger is kept off here; AppModule replaces it.
    logger: ['error', 'warn', 'log'],
  });

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
  // eslint-disable-next-line no-console
  console.log(`→ HabitLab AI backend listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`→ OpenAPI docs at    http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
