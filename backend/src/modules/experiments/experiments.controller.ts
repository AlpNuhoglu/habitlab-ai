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
  @ApiQuery({ name: 'keys', description: 'Comma-separated experiment keys' })
  @ApiResponse({ status: 200, description: 'Map of experimentKey → variantKey' })
  async getVariants(
    @Req() req: Request,
    @Query('keys') keysParam: string,
  ): Promise<Record<string, string>> {
    const { sub: userId } = getUser(req);

    if (!keysParam?.trim()) {
      throw new BadRequestException('keys query parameter is required');
    }

    const keys = keysParam
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (keys.length === 0) {
      throw new BadRequestException('keys must contain at least one experiment key');
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
