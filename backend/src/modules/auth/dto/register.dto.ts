import { ApiProperty } from '@nestjs/swagger';
import type {
  ValidationOptions} from 'class-validator';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MinLength,
  registerDecorator
} from 'class-validator';

export function IsIANATimezone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIANATimezone',
      target: object.constructor,
      propertyName,
      ...(options !== undefined ? { options } : {}),
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.length === 0) return false;
          try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return '$property must be a valid IANA timezone (e.g. Europe/Istanbul)';
        },
      },
    });
  };
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Min 8 chars, at least 1 letter and 1 digit' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'password must contain at least 1 letter and 1 digit',
  })
  password!: string;

  @ApiProperty({ example: 'Europe/Istanbul' })
  @IsString()
  @IsIANATimezone()
  timezone!: string;

  @ApiProperty({ enum: ['en', 'tr'] })
  @IsIn(['en', 'tr'])
  locale!: string;

  @ApiProperty({ description: 'Must be true; false returns 400 CONSENT_REQUIRED' })
  @IsBoolean()
  consentGiven!: boolean;
}
