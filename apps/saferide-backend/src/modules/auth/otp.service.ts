import { Injectable } from '@nestjs/common'
import { createHash, randomInt } from 'crypto'
import { ConfigService } from '../../config/config.service'
import { RedisService } from '../../common/redis.service'

interface OtpRecord {
  hash: string
  expiresAt: number
  attempts: number
  createdAt: number
}

@Injectable()
export class OtpService {
  private readonly expirySeconds: number
  private readonly maxPerHour: number
  private readonly maxFailedAttempts: number

  constructor(
    private config: ConfigService,
    private redis: RedisService,
  ) {
    this.expirySeconds = config.getNumber('OTP_EXPIRY_SECONDS')
    this.maxPerHour = config.getNumber('OTP_MAX_PER_HOUR')
    this.maxFailedAttempts = config.getNumber('OTP_MAX_FAILED_ATTEMPTS')
  }

  private key(phone: string) {
    return `otp:${phone}`
  }

  private codeHash(code: string) {
    return createHash('sha256').update(code).digest('hex')
  }

  private async rateLimitCheck(phone: string): Promise<boolean> {
    const client = this.redis.getClient()
    const windowKey = `otp:rate:${phone}`
    const current = await client.incr(windowKey)
    if (current === 1) {
      await client.expire(windowKey, 3600)
    }
    return current <= this.maxPerHour
  }

  async generate(phone: string): Promise<{ code: string; devCode: boolean }> {
    const allowed = await this.rateLimitCheck(phone)
    if (!allowed) throw new Error('OTP_RATE_LIMITED')

    const code = String(randomInt(100000, 999999))
    const record: OtpRecord = {
      hash: this.codeHash(code),
      expiresAt: Date.now() + this.expirySeconds * 1000,
      attempts: 0,
      createdAt: Date.now(),
    }
    await this.redis.getClient().set(this.key(phone), JSON.stringify(record), 'EX', this.expirySeconds)

    // In dev mode with SMS_MOCK enabled, return the code so flows are testable
    const isMock = this.config.get('SMS_MOCK') === 'true'
    return { code, devCode: isMock }
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const raw = await this.redis.getClient().get(this.key(phone))
    if (!raw) return false

    const record: OtpRecord = JSON.parse(raw)
    if (record.expiresAt < Date.now()) {
      await this.redis.getClient().del(this.key(phone))
      return false
    }
    if (record.attempts >= this.maxFailedAttempts) return false

    if (record.hash !== this.codeHash(code.trim())) {
      record.attempts += 1
      await this.redis.getClient().set(this.key(phone), JSON.stringify(record), 'EX', this.expirySeconds)
      return false
    }

    await this.redis.getClient().del(this.key(phone))
    return true
  }
}
