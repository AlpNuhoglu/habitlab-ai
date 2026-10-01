import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { IsPushServiceUrl } from '../push-endpoint';

// Real values are far smaller (p256dh is 87 chars, auth 22); the caps only
// stop a client from parking arbitrary payloads in push_subscriptions.
class PushKeysDto {
  @ApiProperty({ description: 'P-256 DH public key from the push subscription' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string;

  @ApiProperty({ description: 'Auth secret from the push subscription' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth!: string;
}

export class SubscribeDto {
  @ApiProperty({ description: 'Push endpoint URL from the browser PushSubscription' })
  @MaxLength(2048)
  @IsPushServiceUrl()
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
