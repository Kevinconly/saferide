import { Injectable, UnauthorizedException } from '@nestjs/common'
import { scryptSync, timingSafeEqual } from 'crypto'
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

    const refreshToken = await this.tokens.createRefreshToken(user.id)
    const accessToken = await this.tokens.issueAccessToken(user)

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
      tokens: { accessToken, refreshToken: refreshToken.token, expiresIn: refreshToken.expiresInMs },
    }
  }

  async login(input: {
    phone: string
    password?: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<{ user: unknown; tokens: TokenPair } | { requiresOtp: true }> {
    const phone = normalizePhone(input.phone)
    const user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) throw new UnauthorizedException('Account not found')

    if (user.passwordHash && input.password) {
      const ok = verifyPassword(input.password, user.passwordHash)
      if (!ok) throw new UnauthorizedException('Invalid credentials')
    } else {
      // OTP-first login
      const result = await this.requestOtp({ phone })
      return { requiresOtp: true, ...(result.devCode ? { devCode: result.devCode } : {}) }
    }

    const refreshToken = await this.tokens.createRefreshToken(user.id)
    const accessToken = await this.tokens.issueAccessToken(user)

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
      tokens: { accessToken, refreshToken: refreshToken.token, expiresIn: refreshToken.expiresInMs },
    }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotateRefreshToken(refreshToken)
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken)
    await this.audit.record({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
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

export function hashPassword(password: string): string {
  const salt = scryptSync('saferide', 'salt', 16).toString('hex').slice(0, 16)
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
