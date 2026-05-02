import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';

class PushKeysDto {
  @ApiProperty({ description: 'P-256 DH public key from the push subscription' })
  @IsString()
  p256dh!: string;

  @ApiProperty({ description: 'Auth secret from the push subscription' })
  @IsString()
  auth!: string;
}

export class SubscribeDto {
  @ApiProperty({ description: 'Push endpoint URL from the browser PushSubscription' })
  @IsUrl()
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
