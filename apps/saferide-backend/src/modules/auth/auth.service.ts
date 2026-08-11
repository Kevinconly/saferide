import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { OtpService } from './otp.service'
import { TokenService, TokenPair } from './token.service'

export function normalizePhone(input: string): string {
  let phone = input.replace(/[\s-]/g, '')
  if (phone.startsWith('+')) return phone
  if (phone.startsWith('00')) return `+${phone.slice(2)}`
  if (phone.startsWith('0')) return `+250${phone.slice(1)}`
  if (phone.startsWith('7')) return `+250${phone}`
  return `+${phone}`
}

function isPhoneIdentifier(input: string): boolean {
  return /^\s*(?:\+|00)?[0-9][0-9\s-]{5,18}\s*$/.test(input)
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private otp: OtpService,
    private tokens: TokenService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  async requestOtp(input: { phone: string }): Promise<{ sent: boolean; devCode?: string }> {
    const phone = normalizePhone(input.phone)
    const { code, devCode } = await this.otp.generate(phone)

    // TODO: integrate real SMS provider. devCode is returned only when SMS_MOCK=true.
    if (this.config.get('SMS_MOCK') !== 'true') {
      // eslint-disable-next-line no-console
      console.log(`[SMS][mock off] OTP for ${phone}: ${code}`)
    }

    return { sent: true, devCode: devCode ? code : undefined }
  }

  async signup(input: {
    phone: string
    password: string
    username?: string
    email?: string
    name?: string
    role?: 'PASSENGER' | 'DRIVER'
    ip?: string | null
    userAgent?: string | null
  }): Promise<{ user: unknown; tokens: TokenPair }> {
    const phone = normalizePhone(input.phone)
    const searchFilters = [{ phone }] as Array<{ phone?: string; email?: string; username?: string }>
    if (input.email) {
      searchFilters.push({ email: input.email.toLowerCase() })
    }
    if (input.username) {
      searchFilters.push({ username: normalizeUsername(input.username) })
    }

    const existing = await this.prisma.user.findFirst({ where: { OR: searchFilters } })
    if (existing) {
      throw new ConflictException('Account with this phone, email, or username already exists')
    }

    const user = await this.prisma.user.create({
      data: {
        phone,
        username: input.username ? normalizeUsername(input.username) : null,
        email: input.email?.toLowerCase() ?? null,
        name: input.name ?? null,
        role: input.role ?? 'PASSENGER',
        passwordHash: hashPassword(input.password),
        status: 'ACTIVE',
        isVerified: false,
      },
    })

    const tokens = await this.createSession(user)
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.signup',
      entityType: 'User',
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    return {
      user: this.sanitize(user),
      tokens,
    }
  }

  async verifyOtp(input: {
    phone: string
    code: string
    role?: 'PASSENGER' | 'DRIVER'
    name?: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<{ user: unknown; tokens: TokenPair }> {
    const phone = normalizePhone(input.phone)
    const valid = await this.otp.verify(phone, input.code)
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP')

    let user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          name: input.name ?? null,
          role: input.role ?? 'PASSENGER',
          isVerified: true,
        },
      })
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, deletedAt: null },
      })
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is suspended')
    }

    const tokens = await this.createSession(user)

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.verify_otp',
      entityType: 'User',
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    return {
      user: this.sanitize(user),
      tokens,
    }
  }

  async login(input: {
    identifier: string
    password?: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<{ user: unknown; tokens: TokenPair }> {
    const identifier = input.identifier.trim()
    const searchFilters = [] as Array<{ phone?: string; email?: string; username?: string }>
    if (isPhoneIdentifier(identifier)) {
      searchFilters.push({ phone: normalizePhone(identifier) })
    }
    if (identifier.includes('@')) {
      searchFilters.push({ email: identifier.toLowerCase() })
    }
    searchFilters.push({ username: normalizeUsername(identifier) })

    const user = await this.prisma.user.findFirst({ where: { OR: searchFilters } })
    if (!user) throw new UnauthorizedException('Account not found')

    if (!user.passwordHash || !input.password) {
      throw new UnauthorizedException('Password is required to login')
    }

    const ok = verifyPassword(input.password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid credentials')

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is suspended')
    }

    const tokens = await this.createSession(user)

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    return {
      user: this.sanitize(user),
      tokens,
    }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotateRefreshToken(refreshToken)
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = createHash('sha256').update(refreshToken).digest('hex')
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } })
    if (!existing) return

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.user.update({
        where: { id: existing.userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ])

    await this.audit.record({
      actorId: existing.userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: existing.userId,
    })
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    })
    if (!user) throw new UnauthorizedException('User not found')
    return this.sanitize(user)
  }

  private async createSession(user: {
    id: string
    role: string
    phone?: string | null
    email?: string | null
  }): Promise<TokenPair> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    })

    await this.tokens.revokeUserRefreshTokens(user.id)
    const refreshToken = await this.tokens.createRefreshToken(user.id)
    const accessToken = await this.tokens.issueAccessToken({
      id: updatedUser.id,
      role: updatedUser.role,
      phone: updatedUser.phone ?? undefined,
      email: updatedUser.email ?? undefined,
      tokenVersion: updatedUser.tokenVersion,
    })

    return { accessToken, refreshToken: refreshToken.token, expiresIn: refreshToken.expiresInMs }
  }

  private sanitize(user: {
    id: string
    phone: string
    username?: string | null
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
      username: user.username ?? null,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      isVerified: user.isVerified,
      status: user.status,
      driver: user.driver ?? null,
    }
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}
