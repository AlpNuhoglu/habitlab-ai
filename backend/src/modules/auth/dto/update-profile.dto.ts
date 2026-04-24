import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsIANATimezone } from './register.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alp', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'Europe/Istanbul' })
  @IsOptional()
  @IsIANATimezone({ message: 'timezone must be a valid IANA timezone string.' })
  timezone?: string;

  @ApiPropertyOptional({ enum: ['en', 'tr'] })
  @IsOptional()
  @IsIn(['en', 'tr'])
  locale?: string;
}
