import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExperimentsModule } from '../experiments/experiments.module';
import { NotificationSent } from './entities/notification-sent.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationSentRepository } from './notification-sent.repository';
import { NotificationsController } from './notifications.controller';
import { PushSubscriptionRepository } from './push-subscription.repository';
import { WebPushService } from './web-push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription, NotificationSent]),
    ExperimentsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    PushSubscriptionRepository,
    NotificationSentRepository,
    WebPushService,
    NotificationSchedulerService,
  ],
  exports: [NotificationSchedulerService, WebPushService],
})
export class NotificationsModule {}
