import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Public } from './decorators/public.decorator';

/**
 * Liveness and readiness probes.
 *
 * - GET /health    — always 200 while the process is alive. Never touches external deps.
 * - GET /ready     — 200 iff DB and Redis are reachable. Wired to real checks in WP2+.
 *
 * See the NFR-072 row of the analysis report §4.2.8.
 */
@Public()
@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe. Always 200 while the process is alive.' })
  health(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe. 200 iff all external deps reachable.' })
  ready(): { status: 'ok' | 'degraded'; checks: Record<string, 'ok' | 'fail'> } {
    // TODO(WP2): check Postgres; TODO(WP5): check Redis. For now, always ok.
    return { status: 'ok', checks: { process: 'ok' } };
  }
}
