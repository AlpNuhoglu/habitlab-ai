import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource } from 'typeorm';

import { AssignmentService } from './assignment.service';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

const MAX_KEYS_PER_REQUEST = 20;
const EXPERIMENT_KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;

@ApiTags('experiments')
@Controller('experiments')
export class ExperimentsController {
  private readonly logger = new Logger(ExperimentsController.name);

  constructor(
    private readonly assignmentService: AssignmentService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // FR-072 — variant delivery
  @Get('variant')
  @ApiOperation({ summary: 'Resolve variant assignments for one or more experiment keys (FR-072)' })
  @ApiQuery({ name: 'keys', type: String, description: 'Comma-separated experiment keys' })
  @ApiResponse({ status: 200, description: 'Map of experimentKey → variantKey' })
  async getVariants(
    @Req() req: Request,
    @Query('keys') keysParam: unknown,
  ): Promise<Record<string, string>> {
    const { sub: userId } = getUser(req);

    // `?keys[]=a` arrives as an array, not a string.
    if (typeof keysParam !== 'string' || !keysParam.trim()) {
      throw new BadRequestException('keys query parameter is required');
    }

    const keys = [
      ...new Set(
        keysParam
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      ),
    ];

    if (keys.length === 0) {
      throw new BadRequestException('keys must contain at least one experiment key');
    }
    // Each key costs a lookup, a possible assignment write and an exposure
    // event, so the list is bounded.
    if (keys.length > MAX_KEYS_PER_REQUEST) {
      throw new BadRequestException(`At most ${MAX_KEYS_PER_REQUEST} keys per request`);
    }
    if (!keys.every((k) => EXPERIMENT_KEY_RE.test(k))) {
      throw new BadRequestException('Experiment keys must match [A-Za-z0-9_.-]{1,64}');
    }

    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = await this.assignmentService.getOrAssign(userId, key);
    }

    // §6.5.2 — fire-and-forget exposure events (not in a transaction)
    void this.emitExposureEvents(userId, result).catch((err: unknown) => {
      this.logger.warn(`Failed to emit exposure events: ${String(err)}`);
    });

    return result;
  }

  private async emitExposureEvents(
    userId: string,
    assignments: Record<string, string>,
  ): Promise<void> {
    for (const [experimentKey, variantKey] of Object.entries(assignments)) {
      await this.dataSource.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, payload)
         VALUES ($1, 'experiment.exposure', 'experiment', $2)`,
        [userId, JSON.stringify({ experimentKey, variantKey })],
      );
    }
  }
}
