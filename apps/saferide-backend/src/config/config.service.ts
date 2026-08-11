import { Injectable } from '@nestjs/common'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(''),
  FRONTEND_ORIGIN: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),

  JWT_ACCESS_TOKEN_SECRET: z.string().min(1),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(1),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  OTP_MAX_PER_HOUR: z.coerce.number().default(5),
  OTP_MAX_PER_DAY_PER_IP: z.coerce.number().default(20),
  OTP_MAX_FAILED_ATTEMPTS: z.coerce.number().default(5),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:ops@saferide.rw'),

  SWAGGER_ENABLED: z.string().default('true'),
  LOG_LEVEL: z.string().default('info'),

  FRONTEND_URL: z.string().default('http://localhost:3001'),
  ADMIN_URL: z.string().default('http://localhost:3001/admin'),

  SMS_MOCK: z.string().default('true'),

  SANDBOX_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  PAYMENT_AUTO_CONFIRM_MS: z.coerce.number().default(5000),
})

export type AppConfig = z.infer<typeof envSchema>

@Injectable()
export class ConfigService {
  private readonly config: AppConfig

  constructor() {
    const parsed = envSchema.safeParse(process.env)
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('Invalid environment variables', parsed.error.format())
      throw new Error('Invalid environment variables')
    }
    this.config = parsed.data
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key]
  }

  getNumber(key: keyof AppConfig): number {
    const val = this.get(key)
    return Number(val)
  }

  getCorsOrigins(): string[] {
    const fromOrigin = this.config.FRONTEND_ORIGIN
    const fromList = this.config.CORS_ORIGINS
    if (fromList) {
      return fromList
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (fromOrigin) return [fromOrigin]
    return ['http://localhost:3001']
  }
}
