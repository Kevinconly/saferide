import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import webpush from 'web-push'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RealtimeService } from '../websocket/realtime.service'

interface NotificationEventInput {
  userId: string
  type: string
  payload: Record<string, unknown>
}

interface Template {
  title: string
  body: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService')
  private pushConfigured = false

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private config: ConfigService,
  ) {
    const publicKey = config.get('VAPID_PUBLIC_KEY')
    const privateKey = config.get('VAPID_PRIVATE_KEY')
    if (publicKey && privateKey) {
      webpush.setVapidDetails(config.get('VAPID_SUBJECT'), publicKey, privateKey)
      this.pushConfigured = true
    } else {
      this.logger.warn('VAPID keys not configured - web push disabled')
    }
  }

  async registerSubscription(input: {
    userId: string
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
  }) {
    return this.prisma.notificationSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
        isActive: true,
      },
      update: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        isActive: true,
        userAgent: input.userAgent,
      },
    })
  }

  async removeSubscription(userId: string, endpoint: string) {
    await this.prisma.notificationSubscription.updateMany({
      where: { userId, endpoint },
      data: { isActive: false },
    })
    return { removed: true }
  }

  async list(userId: string, page: number, pageSize: number) {
    const where = { userId }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ])
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    }
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    })
    if (!notification) throw new NotFoundException('Notification not found')
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return { updated: res.count }
  }

  async enqueueFromEvent(input: NotificationEventInput) {
    const template = this.render(input.type, input.payload)
    if (!template) return

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: template.title,
        body: template.body,
        priority: template.priority,
        payload: input.payload as any,
      },
    })

    this.realtime.emitToUser(input.userId, 'notification:new', notification)

    // Fire-and-forget push delivery
    void this.sendPush(input.userId, notification.id, template.title, template.body).catch(
      (err) => this.logger.warn(`Web push failed for user ${input.userId}`, err as any),
    )
  }

  private async sendPush(userId: string, notificationId: string, title: string, body: string) {
    if (!this.pushConfigured) return
    const subs = await this.prisma.notificationSubscription.findMany({
      where: { userId, isActive: true },
    })
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title,
            body,
            notificationId,
            url: `/notifications`,
          }),
        )
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await this.prisma.notificationSubscription.updateMany({
            where: { endpoint: sub.endpoint },
            data: { isActive: false },
          })
        } else {
          this.logger.warn(`Web push error ${err?.statusCode}`, err as any)
        }
      }
    }
  }

  private render(type: string, payload: Record<string, unknown>): Template | null {
    switch (type) {
      case 'ride.assigned':
        return {
          title: 'Driver assigned',
          body: 'Your SafeRide driver is on the way to your pickup location.',
          priority: 'HIGH',
        }
      case 'ride.status_changed':
        return {
          title: 'Ride update',
          body: `Your ride status is now ${this.humanize(String(payload.state ?? ''))}.`,
          priority: 'MEDIUM',
        }
      case 'ride.cancelled':
        return {
          title: 'Ride cancelled',
          body: 'Your ride has been cancelled.',
          priority: 'HIGH',
        }
      case 'ride.completed':
        return {
          title: 'Ride completed',
          body: 'Your ride is complete. Thanks for riding with SafeRide!',
          priority: 'MEDIUM',
        }
      case 'payment.confirmed':
        return {
          title: 'Payment confirmed',
          body: `Your payment of ${this.formatAmount(payload.amountCents as number)} has been confirmed.`,
          priority: 'MEDIUM',
        }
      default:
        return {
          title: 'SafeRide update',
          body: 'You have a new update from SafeRide.',
          priority: 'MEDIUM',
        }
    }
  }

  private humanize(value: string): string {
    return value.toLowerCase().replace(/_/g, ' ')
  }

  private formatAmount(amountCents?: number): string {
    if (typeof amountCents !== 'number') return ''
    return `${(amountCents / 100).toFixed(2)} RWF`
  }
}
