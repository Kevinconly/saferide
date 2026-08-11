import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '../config/config.service'

type SetValue = string | number

interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: SetValue, mode?: string, ttlSeconds?: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ping(): Promise<string>
}

/**
 * In-memory cache used when REDIS_URL is not configured (local dev).
 * Production should always configure REDIS_URL.
 */
class MemoryCache implements CacheClient {
  private readonly store = new Map<string, { value: SetValue; expiresAt: number | null }>()

  private prune(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return false
    }
    return true
  }

  async get(key: string): Promise<string | null> {
    if (!this.prune(key)) return null
    return String(this.store.get(key)!.value)
  }

  async set(key: string, value: SetValue, _mode?: string, ttlSeconds?: number): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1
    }
    return removed
  }

  async incr(key: string): Promise<number> {
    const current = this.prune(key) ? Number(this.store.get(key)!.value) : 0
    const next = current + 1
    this.store.set(key, { value: next, expiresAt: null })
    return next
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return 0
    entry.expiresAt = Date.now() + seconds * 1000
    return 1
  }

  async ping(): Promise<string> {
    return 'PONG'
  }
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger('RedisService')
  private client: CacheClient

  constructor(private config: ConfigService) {
    const url = this.config.get('REDIS_URL')?.trim()
    if (url && url !== 'memory') {
      const redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      })
      redis.connect().catch((err) => {
        this.logger.warn(`Redis unreachable at ${url} - falling back to in-memory cache`, err as any)
        this.client = new MemoryCache()
      })
      redis.on('error', (err) => {
        this.logger.warn('Redis error', err as any)
      })
      this.client = redis as unknown as CacheClient
    } else {
      this.logger.warn('REDIS_URL not set - using in-memory cache (local dev only)')
      this.client = new MemoryCache()
    }
  }

  getClient(): CacheClient {
    return this.client
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.getClient().ping()
      return res === 'PONG'
    } catch {
      return false
    }
  }
}
