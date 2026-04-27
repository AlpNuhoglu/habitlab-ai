import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { BROKER_ADAPTER } from './broker/broker-adapter.interface';
import { REDIS_CLIENT, RedisStreamsBrokerAdapter } from './broker/redis-streams-broker.adapter';
import { StubBrokerAdapter } from './broker/stub-broker.adapter';
import { CACHE_SERVICE } from './cache/cache.interface';
import { NullCacheAdapter } from './cache/null-cache.adapter';
import { RedisCacheAdapter } from './cache/redis-cache.adapter';
import { LLM_PROVIDER } from './llm/llm-provider.interface';
import { NullLlmProvider } from './llm/null-llm.provider';
import { OpenAILlmProvider } from './llm/openai-llm.provider';

function shouldUseStub(config: ConfigService): boolean {
  // process.env.NODE_ENV is set to 'test' by Jest before any module initialises.
  // config.get('NODE_ENV') reads from the loaded .env file which may say 'development',
  // so we read NODE_ENV from process.env directly to get the authoritative value.
  return config.get<string>('BROKER_ADAPTER') === 'stub' || process.env['NODE_ENV'] === 'test';
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
    {
      provide: CACHE_SERVICE,
      useFactory: (config: ConfigService, redis: Redis | null) => {
        if (shouldUseStub(config)) return new NullCacheAdapter();
        return new RedisCacheAdapter(redis!);
      },
      inject: [ConfigService, REDIS_CLIENT],
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (config: ConfigService) => {
        if (shouldUseStub(config) || !config.get<string>('OPENAI_API_KEY')) {
          return new NullLlmProvider();
        }
        return new OpenAILlmProvider(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [BROKER_ADAPTER, REDIS_CLIENT, CACHE_SERVICE, LLM_PROVIDER],
})
export class InfrastructureModule {}
