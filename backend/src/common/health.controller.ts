import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../infrastructure/broker/redis-streams-broker.adapter';
import { Public } from './decorators/public.decorator';

type CheckResult = 'ok' | 'fail' | 'skip';
interface ReadyResponse {
  status: 'ok' | 'degraded';
  checks: Record<string, CheckResult>;
}

@Public()
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe. Always 200 while the process is alive.' })
  health(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe. 503 if Postgres or Redis unreachable.' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadyResponse> {
    const checks: Record<string, CheckResult> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks['postgres'] = 'ok';
    } catch {
      checks['postgres'] = 'fail';
    }

    if (this.redis) {
      try {
        await this.redis.ping();
        checks['redis'] = 'ok';
      } catch {
        checks['redis'] = 'fail';
      }
    } else {
      checks['redis'] = 'skip';
    }

    const degraded = Object.values(checks).some((v) => v === 'fail');
    if (degraded) res.status(503);

    return { status: degraded ? 'degraded' : 'ok', checks };
  }
}
