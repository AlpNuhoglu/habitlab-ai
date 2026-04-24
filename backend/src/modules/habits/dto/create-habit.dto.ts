import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import type { HabitFrequencyType } from '../entities/habit.entity';

export class CreateHabitDto {
  @ApiProperty({ description: '1–120 characters', example: 'Meditate 10 min' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Up to 500 characters' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ enum: ['daily', 'weekly', 'custom'] })
  @IsEnum(['daily', 'weekly', 'custom'])
  frequencyType!: HabitFrequencyType;

  @ApiPropertyOptional({
    description: 'Bit 0=Mon..bit 6=Sun; required when frequencyType=weekly',
    example: 21,
  })
  @ValidateIf((o: CreateHabitDto) => o.frequencyType === 'weekly')
  @IsInt()
  @Min(0)
  @Max(127)
  weekdayMask?: number | null;

  @ApiPropertyOptional({
    description: '1–7; required when frequencyType=custom',
    example: 3,
  })
  @ValidateIf((o: CreateHabitDto) => o.frequencyType === 'custom')
  @IsInt()
  @Min(1)
  @Max(7)
  targetCountPerWeek?: number | null;

  @ApiPropertyOptional({ description: 'HH:MM in user local time', example: '07:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'preferredTime must be HH:MM' })
  preferredTime?: string | null;

  @ApiPropertyOptional({ description: '1 (easy) .. 5 (hard)', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
}
