import { ApiProperty } from '@nestjs/swagger';
import { IsByteLength, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { BCRYPT_MAX_PASSWORD_BYTES } from '../../../common/validation/password-limits';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  token!: string;

  @ApiProperty({ description: 'Min 8 chars, at least 1 letter and 1 digit' })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, BCRYPT_MAX_PASSWORD_BYTES, {
    message: `$property must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`,
  })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'newPassword must contain at least 1 letter and 1 digit',
  })
  newPassword!: string;
}
