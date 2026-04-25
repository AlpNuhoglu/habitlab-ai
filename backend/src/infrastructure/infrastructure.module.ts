import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { BROKER_ADAPTER } from './broker/broker-adapter.interface';
import { REDIS_CLIENT, RedisStreamsBrokerAdapter } from './broker/redis-streams-broker.adapter';
import { StubBrokerAdapter } from './broker/stub-broker.adapter';

function shouldUseStub(config: ConfigService): boolean {
  return (
    config.get<string>('BROKER_ADAPTER') === 'stub' ||
    config.get<string>('NODE_ENV') === 'test'
  );
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis | null => {
        if (shouldUseStub(config)) return null;
        return new Redis(config.getOrThrow<string>('REDIS_URL'));
      },
      inject: [ConfigService],
    },
    {
      provide: BROKER_ADAPTER,
      useFactory: (config: ConfigService, redis: Redis | null) => {
        if (shouldUseStub(config)) return new StubBrokerAdapter();
        return new RedisStreamsBrokerAdapter(redis!);
      },
      inject: [ConfigService, REDIS_CLIENT],
    },
  ],
  exports: [BROKER_ADAPTER, REDIS_CLIENT],
})
export class InfrastructureModule {}
