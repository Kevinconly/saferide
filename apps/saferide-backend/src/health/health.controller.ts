import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../common/redis.service'
import { Public } from '../common/decorators/public.decorator'

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  @Public()
  @Get('live')
  liveness() {
    return { status: 'ok' }
  }

  @Public()
  @Get('ready')
  async readiness() {
    const dbOk = await this.checkDb()
    const redisOk = await this.redis.ping()
    const ok = dbOk && redisOk
    return { status: ok ? 'ok' : 'error', checks: { db: dbOk, redis: redisOk } }
  }

  private async checkDb(): Promise<boolean> {
    try {
      // lightweight MongoDB ping
      await this.prisma.$runCommandRaw({ ping: 1 })
      return true
    } catch (err) {
      return false
    }
  }
}
