import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notifications/notification.service'

interface OutboxInput {
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: Record<string, unknown>
}

type Tx = Prisma.TransactionClient

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OutboxService')
  private timer: NodeJS.Timeout | null = null

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  createInTx(tx: Tx, input: OutboxInput): Promise<unknown> {
    return tx.outbox.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as any,
      },
    })
  }

  async create(input: OutboxInput): Promise<void> {
    await this.prisma.outbox.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as any,
      },
    })
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.poll(), 3000)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async poll(): Promise<void> {
    try {
      const batch = await this.prisma.outbox.findMany({
        where: { deliveredAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      })

      if (!Array.isArray(batch)) {
        this.logger.error('Outbox poll returned a non-array batch', { batch })
        return
      }

      for (const row of batch) {
        try {
          await this.process(row)
        } catch (err) {
          await this.prisma.outbox.update({
            where: { id: row.id },
            data: { attempts: { increment: 1 } },
          })
          if (row.attempts >= 4) {
            this.logger.error(`Outbox ${row.id} giving up`, err as any)
          }
        }
      }
    } catch (err) {
      this.logger.error('Outbox poll failed', err as any)
    }
  }

  private async process(row: {
    id: string
    aggregateType: string
    aggregateId: string
    eventType: string
    payload: any
  }): Promise<void> {
    const payload = row.payload ?? {}

    switch (row.eventType) {
      case 'ride.assigned':
      case 'ride.cancelled':
      case 'ride.completed':
      case 'ride.status_changed': {
        const userId = payload.passengerId ?? payload.userId
        if (userId) {
          await this.notifications.enqueueFromEvent({
            userId,
            type: row.eventType,
            payload,
          })
        }
        break
      }
      case 'payment.confirmed': {
        const userId = payload.userId
        if (userId) {
          await this.notifications.enqueueFromEvent({
            userId,
            type: row.eventType,
            payload,
          })
        }
        break
      }
      default:
        break
    }

    await this.prisma.outbox.update({
      where: { id: row.id },
      data: { deliveredAt: new Date() },
    })
  }
}
