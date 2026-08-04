import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface AuditEntryInput {
  actorId?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(input: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata ? (input.metadata as any) : undefined,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      })
    } catch (err) {
      // Audit must never break the main flow
      // eslint-disable-next-line no-console
      console.error('Audit write failed', err)
    }
  }
}
