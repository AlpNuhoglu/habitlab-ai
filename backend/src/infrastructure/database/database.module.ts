import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PRIVILEGED_DATA_SOURCE } from './database.tokens';
import { RLS_CLIENT_CTOR } from './rls-client';

/**
 * Owns both connection pools (NFR-038).
 *
 * The default pool is what every request path uses; once RLS lands it connects
 * as a de-privileged role and carries the caller's tenant on its session. It
 * stays the *default* DataSource on purpose, so existing `@InjectDataSource()`
 * and `@InjectRepository()` sites become tenant-scoped without being touched.
 *
 * The privileged pool is a bare provider rather than a second
 * `TypeOrmModule.forRoot({ name: 'privileged' })`, because registering it with
 * TypeORM would make `@InjectDataSource('privileged')` resolvable from anywhere
 * with a bare string. Requiring the shouty token means bypassing RLS always
 * shows up in the diff.
 */
function poolExtras(): Record<string, unknown> {
  return {
    // Stamps the request's tenant onto the session before every statement, so
    // RLS policies have an identity to match against.
    Client: RLS_CLIENT_CTOR,
    // Keep the pool small in test so sequential e2e suites don't exhaust
    // Postgres max_connections when suites boot/close back-to-back.
    ...(process.env['NODE_ENV'] === 'test' ? { max: 3, idleTimeoutMillis: 1000 } : {}),
  };
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') !== 'production',
        extra: poolExtras(),
      }),
    }),
  ],
  providers: [
    {
      provide: PRIVILEGED_DATA_SOURCE,
      useFactory: async (config: ConfigService): Promise<DataSource> => {
        const ds = new DataSource({
          name: 'privileged',
          type: 'postgres',
          url: config.getOrThrow<string>('DATABASE_URL'),
          entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: false,
          extra: process.env['NODE_ENV'] === 'test' ? { max: 2, idleTimeoutMillis: 1000 } : {},
        });
        return ds.initialize();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PRIVILEGED_DATA_SOURCE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(PRIVILEGED_DATA_SOURCE) private readonly privileged: DataSource,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // TypeORM does not manage this pool, so nothing else will close it. Without
    // this, e2e suites leak a pool per booted app and exhaust max_connections.
    if (this.privileged.isInitialized) {
      await this.privileged.destroy();
    }
  }
}
