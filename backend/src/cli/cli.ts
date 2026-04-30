/* eslint-disable no-console */
import 'reflect-metadata';

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

// Load env before any NestJS module is imported
const root = resolve(__dirname, '../..');
dotenv.config({ path: resolve(root, '.env.local') });
dotenv.config({ path: resolve(root, '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ExperimentRepository } from '../modules/experiments/experiment.repository';
import { ExperimentCommands } from './experiment.commands';

async function run(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.error('Usage: pnpm cli <command> [options]');
    console.error('Commands: experiment:create, experiment:start, experiment:pause, experiment:analyze');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const dataSource = app.get(DataSource);
  const experimentRepo = app.get(ExperimentRepository);
  const commands = new ExperimentCommands(dataSource, experimentRepo);

  try {
    switch (command) {
      case 'experiment:create': {
        const fileFlag = args.indexOf('--file');
        if (fileFlag === -1 || !args[fileFlag + 1]) {
          throw new Error('experiment:create requires --file <path>');
        }
        await commands.create(args[fileFlag + 1]!);
        break;
      }

      case 'experiment:start': {
        const key = getKeyArg(args);
        await commands.start(key);
        break;
      }

      case 'experiment:pause': {
        const key = getKeyArg(args);
        await commands.pause(key);
        break;
      }

      case 'experiment:analyze': {
        const key = getKeyArg(args);
        await commands.analyze(key);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await app.close();
  }
}

function getKeyArg(args: string[]): string {
  const keyFlag = args.indexOf('--key');
  if (keyFlag === -1 || !args[keyFlag + 1]) {
    throw new Error('This command requires --key <experiment_key>');
  }
  return args[keyFlag + 1]!;
}

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
