import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { LoggingModule } from './logging/logging.module'
import { CommonModule } from './common/common.module'

@Module({
  imports: [ConfigModule, LoggingModule, PrismaModule, CommonModule, HealthModule],
})
export class AppModule {}
