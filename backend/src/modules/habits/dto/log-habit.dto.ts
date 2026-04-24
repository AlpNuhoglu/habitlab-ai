import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import type { HabitLogStatus } from '../entities/habit-log.entity';

export class LogHabitDto {
  @ApiProperty({ enum: ['completed', 'skipped'] })
  @IsEnum(['completed', 'skipped'])
  status!: HabitLogStatus;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD; defaults to today in user\'s timezone',
    example: '2026-04-22',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Max 500 characters' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
