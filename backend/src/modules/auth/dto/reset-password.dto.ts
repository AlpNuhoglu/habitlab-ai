import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'Min 8 chars, at least 1 letter and 1 digit' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'newPassword must contain at least 1 letter and 1 digit',
  })
  newPassword!: string;
}
