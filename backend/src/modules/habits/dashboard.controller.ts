import { Controller, Get, Inject, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { CACHE_SERVICE, ICacheService } from '../../infrastructure/cache/cache.interface';
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
  constructor(
    @Inject(HabitsService) private readonly habitsService: HabitsService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard summary (FR-040)' })
  @ApiResponse({ status: 200 })
  async getDashboard(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { sub: userId } = getUser(req);

    res.setHeader('Cache-Control', 'no-store');

    // Read-through cache (§6.4.2) — TTL 300s (§6.4.1)
    const cached = await this.cacheService.get(CacheKeys.dashboard(userId));
    if (cached !== null) {
      res.setHeader('X-Cache', 'HIT');
      return cached;
    }

    res.setHeader('X-Cache', 'MISS');
    const data = await this.habitsService.getDashboard(userId);
    await this.cacheService.set(CacheKeys.dashboard(userId), data, 300);
    return data;
  }
}
