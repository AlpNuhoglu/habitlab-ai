import { Controller, Get, Inject, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { HabitsService } from './habits.service';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(HabitsService) private readonly habitsService: HabitsService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard summary (FR-040)' })
  @ApiResponse({ status: 200 })
  async getDashboard(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { sub: userId } = getUser(req);

    // WP5 will add Redis cache. In WP3 every request hits Postgres.
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'no-store');

    return this.habitsService.getDashboard(userId);
  }
}
