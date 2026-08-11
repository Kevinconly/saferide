import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../../config/config.service'
import { AuditService } from '../audit/audit.service'
import { OutboxService } from '../outbox/outbox.service'

@Injectable()
export class PaymentsService implements OnModuleDestroy {
  private readonly logger = new Logger('PaymentsService')
  private timers = new Set<NodeJS.Timeout>()

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
    private outbox: OutboxService,
  ) {}

  async initiateForRide(userId: string, rideId: string, idempotencyKey?: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } })
    if (!ride) throw new NotFoundException('Ride not found')
    if (ride.passengerId !== userId) throw new ForbiddenException('You cannot pay for someone else\'s ride')
    if (ride.state !== 'COMPLETED') {
      throw new BadRequestException('Payment is only available after the ride is completed')
    }

    const existing = await this.prisma.payment.findUnique({ where: { rideId } })
    if (existing) return this.publicPayment(existing)

    const payment = await this.prisma.payment.create({
      data: {
        rideId,
        userId,
        amountCents: ride.fareCents,
        currency: 'RWF',
        provider: 'sandbox',
        providerReference: `pay_${rideId}`,
        idempotencyKey: idempotencyKey ?? null,
        status: 'PROCESSING',
      },
    })

    await this.audit.record({
      actorId: userId,
      actorRole: 'PASSENGER',
      action: 'payment.initiated',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { rideId, amountCents: ride.fareCents },
    })

    this.scheduleAutoConfirm(payment.id)
    return this.publicPayment(payment)
  }

  async simulateSuccess(paymentId: string) {
    return this.confirm(paymentId, 'simulated')
  }

  async webhookSandbox(paymentId: string, secret: string) {
    const expected = this.config.get('SANDBOX_WEBHOOK_SECRET') ?? 'sandbox-secret'
    if (!secret || secret !== expected) {
      throw new ForbiddenException('Invalid webhook signature')
    }
    return this.confirm(paymentId, 'webhook')
  }

  async refund(userId: string, paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.userId !== userId) throw new ForbiddenException('You cannot refund this payment')
    if (payment.status !== 'SUCCESS') {
      throw new BadRequestException(`Only successful payments can be refunded (status: ${payment.status})`)
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', refundReason: reason ?? null, processedAt: new Date() },
    })

    await this.audit.record({
      actorId: userId,
      actorRole: 'PASSENGER',
      action: 'payment.refunded',
      entityType: 'payment',
      entityId: paymentId,
      metadata: { reason: reason ?? null },
    })
    return this.publicPayment(updated)
  }

  async listMine(userId: string, page: number, pageSize: number) {
    const where = { userId }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }

  async getById(userId: string, paymentId: string, role?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new NotFoundException('Payment not found')
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
    if (payment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have access to this payment')
    }
    return this.publicPayment(payment)
  }

  async getByRide(userId: string, rideId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { rideId } })
    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.userId !== userId) throw new ForbiddenException('You do not have access to this payment')
    return this.publicPayment(payment)
  }

  private async confirm(paymentId: string, source: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!existing) throw new NotFoundException('Payment not found')
    if (existing.status === 'SUCCESS') {
      // Idempotent: already confirmed
      return this.publicPayment(existing)
    }
    if (existing.status === 'REFUNDED' || existing.status === 'FAILED') {
      throw new BadRequestException(`Payment cannot be confirmed from status ${existing.status}`)
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCESS', processedAt: new Date() },
    })

    if (existing.userId) {
      await this.outbox.create({
        aggregateType: 'payment',
        aggregateId: paymentId,
        eventType: 'payment.confirmed',
        payload: { paymentId, rideId: existing.rideId ?? undefined, userId: existing.userId, amountCents: existing.amountCents },
      })
    }

    await this.audit.record({
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'payment.confirmed',
      entityType: 'payment',
      entityId: paymentId,
      metadata: { source, provider: 'sandbox' },
    })
    return this.publicPayment(updated)
  }

  private scheduleAutoConfirm(paymentId: string) {
    const delay = this.config.get('PAYMENT_AUTO_CONFIRM_MS')
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      void this.confirm(paymentId, 'auto').catch((err) =>
        this.logger.warn(`Auto-confirm failed for payment ${paymentId}`, err as any),
      )
    }, delay)
    this.timers.add(timer)
  }

  private publicPayment(p: {
    id: string
    amountCents: number
    currency: string
    provider: string
    providerReference: string | null
    status: string
    rideId: string | null
    processedAt: Date | null
    createdAt: Date
    refundReason: string | null
  }) {
    return {
      id: p.id,
      amountCents: p.amountCents,
      amount: p.amountCents / 100,
      currency: p.currency,
      provider: p.provider,
      providerReference: p.providerReference,
      status: p.status,
      rideId: p.rideId,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      refundReason: p.refundReason,
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
  }
}
