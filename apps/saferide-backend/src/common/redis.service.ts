import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '../config/config.service'

@Injectable()
export class RedisService {
  private client: Redis | null = null

  constructor(private config: ConfigService) {
    const url = this.config.get('REDIS_URL')
    this.client = new Redis(url)
    this.client.on('error', (err) => {
      // Application-level logging can pick this up
      // eslint-disable-next-line no-console
      console.error('Redis error', err)
    })
  }

  getClient(): Redis {
    if (!this.client) throw new Error('Redis client not initialized')
    return this.client
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.getClient().ping()
      return res === 'PONG'
    } catch (err) {
      return false
    }
  }
}
