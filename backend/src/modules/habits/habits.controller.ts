import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CreateHabitDto } from './dto/create-habit.dto';
import { LogHabitDto } from './dto/log-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { HabitsService, todayInTimezone } from './habits.service';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

@ApiTags('habits')
@Controller('habits')
export class HabitsController {
  constructor(@Inject(HabitsService) private readonly habitsService: HabitsService) {}

  // ─── List (FR-021) ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List habits (FR-021)' })
  @ApiQuery({ name: 'include_archived', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  list(
    @Req() req: Request,
    @Query('include_archived') includeArchived?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { sub: userId } = getUser(req);
    const parsedLimit = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const parsedOffset = parseInt(offset ?? '0', 10) || 0;

    return this.habitsService.listHabits(userId, {
      includeArchived: includeArchived === 'true',
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  // ─── Create (FR-020) ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create habit (FR-020)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Req() req: Request, @Body() dto: CreateHabitDto) {
    const { sub: userId } = getUser(req);
    return this.habitsService.createHabit(userId, dto);
  }

  // ─── Get (FR-022) ─────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get habit with computed stats (FR-022)' })
  @ApiResponse({ status: 404 })
  getOne(@Req() req: Request, @Param('id') habitId: string) {
    const { sub: userId } = getUser(req);
    return this.habitsService.getHabit(userId, habitId);
  }

  // ─── Update (FR-023) ──────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Partial update habit (FR-023)' })
  update(@Req() req: Request, @Param('id') habitId: string, @Body() dto: UpdateHabitDto) {
    const { sub: userId } = getUser(req);
    return this.habitsService.updateHabit(userId, habitId, dto);
  }

  // ─── Archive / hard-delete (FR-024, FR-025) ───────────────────────────────

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive or hard-delete habit (FR-024/025)' })
  @ApiQuery({ name: 'hard', required: false, type: Boolean })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'HARD_DELETE_LIMIT' })
  async remove(
    @Req() req: Request,
    @Param('id') habitId: string,
    @Query('hard') hard?: string,
  ) {
    const { sub: userId } = getUser(req);
    if (hard === 'true') {
      await this.habitsService.hardDeleteHabit(userId, habitId);
    } else {
      await this.habitsService.archiveHabit(userId, habitId);
    }
    return;
  }

  // ─── Unarchive (FR-024) ───────────────────────────────────────────────────

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive habit (FR-024)' })
  unarchive(@Req() req: Request, @Param('id') habitId: string) {
    const { sub: userId } = getUser(req);
    return this.habitsService.unarchiveHabit(userId, habitId);
  }

  // ─── Log (FR-030, FR-031) ─────────────────────────────────────────────────

  @Post(':id/log')
  @ApiOperation({ summary: 'Log habit completion or skip (FR-030/031)' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 200, description: 'Updated (idempotent)' })
  @ApiResponse({ status: 409, description: 'HABIT_ARCHIVED' })
  async logHabit(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id') habitId: string,
    @Body() dto: LogHabitDto,
  ) {
    const { sub: userId } = getUser(req);
    const timezone = await this.habitsService.getUserTimezone(userId);
    const logDate = dto.date ?? todayInTimezone(timezone);

    const { log, isNew, currentStreak, longestStreak } =
      await this.habitsService.logHabit(userId, habitId, dto.status, logDate, dto.note ?? null, timezone);

    res.status(isNew ? 201 : 200);

    return {
      log: {
        id: log.id,
        habitId: log.habitId,
        date: log.logDate,
        status: log.status,
        note: log.note,
        loggedAt: log.loggedAt,
      },
      habitStreak: { current: currentStreak, longest: longestStreak },
    };
  }

  // ─── Remove log (FR-033) ──────────────────────────────────────────────────

  @Delete(':id/log/:date')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove log for a date (FR-033)' })
  async removeLog(
    @Req() req: Request,
    @Param('id') habitId: string,
    @Param('date') logDate: string,
  ) {
    const { sub: userId } = getUser(req);
    const timezone = await this.habitsService.getUserTimezone(userId);
    await this.habitsService.removeLog(userId, habitId, logDate, timezone);
    return;
  }

  // ─── Update note (FR-034) ─────────────────────────────────────────────────

  @Patch(':id/log/:date')
  @ApiOperation({ summary: 'Edit log note (FR-034)' })
  async updateLogNote(
    @Req() req: Request,
    @Param('id') habitId: string,
    @Param('date') logDate: string,
    @Body() dto: UpdateLogDto,
  ) {
    const { sub: userId } = getUser(req);
    const log = await this.habitsService.updateLogNote(userId, habitId, logDate, dto.note);
    return {
      id: log.id,
      habitId: log.habitId,
      date: log.logDate,
      status: log.status,
      note: log.note,
      updatedAt: log.updatedAt,
    };
  }
}
