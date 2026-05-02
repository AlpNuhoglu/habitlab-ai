import {
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { SubscribeDto } from './dto/subscribe.dto';
import { PushSubscriptionRepository } from './push-subscription.repository';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly pushSubscriptionRepo: PushSubscriptionRepository) {}

  // FR-060 — subscribe to web push
  @Post('subscriptions')
  @ApiOperation({ summary: 'Register a push subscription (FR-060)' })
  @ApiResponse({ status: 201, description: 'New subscription created' })
  @ApiResponse({ status: 200, description: 'Existing subscription updated (same endpoint)' })
  async subscribe(
    @Req() req: Request,
    @Body() body: SubscribeDto,
  ): Promise<{ id: string }> {
    const { sub: userId } = getUser(req);

    const { subscription, isNew } = await this.pushSubscriptionRepo.upsertByEndpoint({
      userId,
      endpoint: body.endpoint,
      keysP256dh: body.keys.p256dh,
      keysAuth: body.keys.auth,
      userAgent: body.userAgent ?? null,
    });

    // Mutate response status: 201 for new, 200 for update
    const res = req.res;
    if (isNew && res) res.status(201);

    return { id: subscription.id };
  }

  // FR-061 — unsubscribe
  @Delete('subscriptions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a push subscription (FR-061)' })
  @ApiResponse({ status: 204, description: 'Subscription removed' })
  @ApiResponse({ status: 404, description: 'Subscription not found or not owned by caller' })
  async unsubscribe(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const { sub: userId } = getUser(req);
    const deleted = await this.pushSubscriptionRepo.deleteById(id, userId);
    if (!deleted) throw new NotFoundException('Subscription not found');
  }
}
