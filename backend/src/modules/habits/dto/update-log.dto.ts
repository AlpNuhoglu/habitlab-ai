import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateLogDto {
  @ApiProperty({ description: 'Max 500 characters' })
  @IsString()
  @MaxLength(500)
  note!: string;
}
