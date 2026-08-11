import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { RidesService } from '../rides/rides.service'

const ACTIVE_RIDE_STATES = ['REQUESTED', 'MATCHING', 'RESERVED', 'OFFERED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'EN_ROUTE_TO_DROPOFF']

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rides: RidesService,
  ) {}

  async stats() {
    const [totalUsers, totalDrivers, pendingDrivers, totalRides, activeRides, completedRides, successfulPayments] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.driver.count(),
        this.prisma.driver.count({ where: { isVerified: false } }),
        this.prisma.ride.count(),
        this.prisma.ride.count({ where: { state: { in: ACTIVE_RIDE_STATES } } }),
        this.prisma.ride.count({ where: { state: 'COMPLETED' } }),
        this.prisma.payment.findMany({
          where: { status: 'SUCCESS' },
          select: { amountCents: true },
        }),
      ])

    const revenueCents = successfulPayments.reduce((sum, p) => sum + p.amountCents, 0)

    const recentRides = await this.prisma.ride.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { include: { user: { select: { id: true, name: true, phone: true } } } },
      },
    })

    return {
      counts: {
        users: totalUsers,
        drivers: totalDrivers,
        pendingDrivers,
        rides: totalRides,
        activeRides,
        completedRides,
      },
      revenueCents,
      recentRides,
    }
  }

  async listUsers(page: number, pageSize: number, search?: string) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { phone: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          role: true,
          status: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { rides: true, payments: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        driver: true,
        _count: { select: { rides: true, payments: true, disputes: true } },
      },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async setUserStatus(adminId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new NotFoundException('User not found')

    const user = await this.prisma.user.update({ where: { id: userId }, data: { status } })
    await this.audit.record({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: `user.${status.toLowerCase()}`,
      entityType: 'user',
      entityId: userId,
      metadata: { from: existing.status, to: status },
    })
    return user
  }

  async listDrivers(page: number, pageSize: number, search?: string) {
    const where: Prisma.DriverWhereInput = search
      ? {
          OR: [
            { plateNumber: { contains: search, mode: 'insensitive' } },
            { vehicleModel: { contains: search, mode: 'insensitive' } },
            { user: { phone: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, phone: true, name: true, email: true, status: true } },
          _count: { select: { rides: true } },
        },
      }),
      this.prisma.driver.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }

  async getDriver(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: true,
        documents: true,
        payouts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!driver) throw new NotFoundException('Driver not found')
    return driver
  }

  async approveDriver(adminId: string, driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } })
    if (!driver) throw new NotFoundException('Driver not found')

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { isVerified: true, status: 'ACTIVE' },
    })
    await this.audit.record({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'driver.approved',
      entityType: 'driver',
      entityId: driverId,
      metadata: { userId: driver.userId },
    })
    return updated
  }

  async rejectDriver(adminId: string, driverId: string, reason?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } })
    if (!driver) throw new NotFoundException('Driver not found')

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { isVerified: false, status: 'REJECTED' },
    })
    await this.audit.record({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'driver.rejected',
      entityType: 'driver',
      entityId: driverId,
      metadata: { userId: driver.userId, reason: reason ?? null },
    })
    return updated
  }

  async listRides(page: number, pageSize: number, state?: string, search?: string) {
    const where: Prisma.RideWhereInput = {}
    if (state) where.state = state
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { passenger: { phone: { contains: search, mode: 'insensitive' } } },
      ]
    }
    const [items, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          passenger: { select: { id: true, name: true, phone: true } },
          driver: { include: { user: { select: { id: true, name: true, phone: true } } } },
          payment: true,
        },
      }),
      this.prisma.ride.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }

  async getRide(rideId: string) {
    return this.rides.getById('__admin__', rideId, 'ADMIN')
  }

  async listPayments(page: number, pageSize: number, status?: string) {
    const where: Prisma.PaymentWhereInput = {}
    if (status) where.status = status
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ride: { select: { id: true, state: true, createdAt: true } } },
      }),
      this.prisma.payment.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }

  async refundPayment(adminId: string, paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new NotFoundException('Payment not found')

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', refundReason: reason ?? 'Refunded by admin', processedAt: new Date() },
    })
    await this.audit.record({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'payment.refunded',
      entityType: 'payment',
      entityId: paymentId,
      metadata: { reason: reason ?? null },
    })
    return updated
  }

  async listAuditLogs(page: number, pageSize: number, actorId?: string, action?: string) {
    const where: Prisma.AuditLogWhereInput = {}
    if (actorId) where.actorId = actorId
    if (action) where.action = { contains: action }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total }
  }
}
