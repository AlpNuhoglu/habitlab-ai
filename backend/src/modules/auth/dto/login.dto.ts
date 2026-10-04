import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { MAX_SUBMITTED_PASSWORD_LENGTH } from '../../../common/validation/password-limits';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SUBMITTED_PASSWORD_LENGTH)
  password!: string;
}
