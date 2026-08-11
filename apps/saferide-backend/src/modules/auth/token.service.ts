import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes } from 'crypto'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async issueAccessToken(user: {
    id: string
    role: string
    phone?: string | null
    email?: string | null
    tokenVersion?: number
  }): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: user.id,
        role: user.role,
        phone: user.phone ?? undefined,
        email: user.email ?? undefined,
        tokenVersion: user.tokenVersion,
      },
      {
        secret: this.config.get('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TOKEN_EXPIRES_IN') as any,
      },
    )
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    })
  }

  private generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url')
    const hash = createHash('sha256').update(token).digest('hex')
    return { token, hash }
  }

  async createRefreshToken(userId: string): Promise<{ token: string; expiresInMs: number }> {
    const { token, hash } = this.generateRefreshToken()
    const expiresIn = this.config.get('JWT_REFRESH_TOKEN_EXPIRES_IN')
    const ttlMs = parseDuration(expiresIn)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })
    return { token, expiresInMs: ttlMs }
  }

  async rotateRefreshToken(oldToken: string): Promise<TokenPair> {
    const oldHash = createHash('sha256').update(oldToken).digest('hex')
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } })

    if (!existing || existing.revoked || existing.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN')
    }

    // Rotate: revoke old, create new
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    })

    const { token, hash } = this.generateRefreshToken()
    const ttlMs = parseDuration(this.config.get('JWT_REFRESH_TOKEN_EXPIRES_IN'))
    await this.prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } })
    if (!user) throw new Error('USER_NOT_FOUND')

    const accessToken = await this.issueAccessToken(user)
    return { accessToken, refreshToken: token, expiresIn: ttlMs }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const hash = createHash('sha256').update(refreshToken).digest('hex')
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revoked: false },
      data: { revoked: true },
    })
  }

  hashSecret(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) return 30 * 24 * 60 * 60 * 1000
  const n = parseInt(match[1], 10)
  switch (match[2]) {
    case 's':
      return n * 1000
    case 'm':
      return n * 60 * 1000
    case 'h':
      return n * 60 * 60 * 1000
    case 'd':
      return n * 24 * 60 * 60 * 1000
    default:
      return 30 * 24 * 60 * 60 * 1000
  }
}
