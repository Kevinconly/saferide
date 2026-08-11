import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Errors } from '../../common/exceptions/app-error'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    })
    if (!user) throw Errors.notFound('User not found')
    return this.sanitize(user)
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw Errors.notFound('User not found')

    if (data.email && data.email !== existing.email) {
      const taken = await this.prisma.user.findFirst({ where: { email: data.email } })
      if (taken && taken.id !== userId) {
        throw Errors.conflict('Email already in use')
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name, email: data.email },
    })
    return this.sanitize(user)
  }

  async getRideHistory(userId: string, page: number, pageSize: number) {
    const where = { passengerId: userId }
    const [items, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { driver: { include: { user: { select: { name: true } } } } },
      }),
      this.prisma.ride.count({ where }),
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

  private sanitize(user: {
    id: string
    phone: string
    email?: string | null
    name?: string | null
    role: string
    isVerified: boolean
    status: string
    driver?: unknown
  }) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      isVerified: user.isVerified,
      status: user.status,
      driver: user.driver ?? null,
    }
  }
}
