import { Injectable } from '@nestjs/common'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().optional(),
})

export type AppConfig = z.infer<typeof envSchema>

@Injectable()
export class ConfigService {
  private readonly config: AppConfig

  constructor() {
    const parsed = envSchema.safeParse(process.env)
    if (!parsed.success) {
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
}
