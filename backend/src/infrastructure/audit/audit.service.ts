import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface AuditEntry {
  userId: string | null;
  actorType?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  log(entry: AuditEntry): void {
    const { userId, actorType = 'user', action, targetType, targetId, details, ipAddress, userAgent } = entry;
    this.dataSource
      .query(
        `INSERT INTO audit_log
           (user_id, actor_type, action, target_type, target_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
        [
          userId ?? null,
          actorType,
          action,
          targetType ?? null,
          targetId ?? null,
          details ? JSON.stringify(details) : null,
          ipAddress ?? null,
          userAgent ?? null,
        ],
      )
      .catch((err: unknown) => {
        this.logger.error(`audit INSERT failed for action=${action}`, String(err));
      });
  }
}
