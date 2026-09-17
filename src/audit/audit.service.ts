import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

const SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'apikey',
  'api_key',
]);

export interface AuditLogInput {
  companyId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(input: AuditLogInput): Promise<AuditLog> {
    const entry = this.auditLogRepository.create({
      companyId: input.companyId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: this.sanitizeValues(input.oldValues),
      newValues: this.sanitizeValues(input.newValues),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const saved = await this.auditLogRepository.save(entry);
    this.logger.debug(`Audit: ${input.action} on ${input.entityType}:${input.entityId}`);
    return saved;
  }

  private sanitizeValues(
    values?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!values) {
      return null;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (SECRET_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeValues(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
