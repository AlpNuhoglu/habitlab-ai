import { Module } from '@nestjs/common';

import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OutboxPublisher } from './outbox-publisher.service';

@Module({
  imports: [InfrastructureModule],
  providers: [OutboxPublisher],
  exports: [OutboxPublisher],
})
export class EventsModule {}
