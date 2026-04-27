import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AnalyticsService } from './analytics.service';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CALENDAR_DAYS = 365;

@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('habits/:id/analytics')
  @ApiOperation({ summary: 'Per-habit analytics (FR-041)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Analytics not yet computed for this habit' })
  getHabitAnalytics(@Req() req: Request, @Param('id', ParseUUIDPipe) habitId: string) {
    const { sub: userId } = getUser(req);
    return this.analyticsService.getHabitAnalytics(userId, habitId);
  }

  @Get('habits/:id/calendar')
  @ApiOperation({ summary: 'Habit log calendar heatmap (FR-042)' })
  @ApiQuery({ name: 'from', description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', description: 'YYYY-MM-DD' })
  @ApiResponse({ status: 200 })
  getCalendar(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) habitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const { sub: userId } = getUser(req);

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new BadRequestException('from and to must be YYYY-MM-DD');
    }
    if (from > to) {
      throw new BadRequestException('from must be ≤ to');
    }
    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T00:00:00Z');
    const diffDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (diffDays > MAX_CALENDAR_DAYS) {
      throw new BadRequestException(`Calendar window cannot exceed ${MAX_CALENDAR_DAYS} days`);
    }

    return this.analyticsService.getCalendar(userId, habitId, from, to);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Global cross-habit analytics (FR-043)' })
  @ApiResponse({ status: 200 })
  getGlobalAnalytics(@Req() req: Request) {
    const { sub: userId } = getUser(req);
    return this.analyticsService.getGlobalAnalytics(userId);
  }
}
