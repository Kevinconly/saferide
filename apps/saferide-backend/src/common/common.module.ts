import { Global, Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from '../config/config.module'
import { RedisService } from './redis.service'
import { AllExceptionsFilter } from './filters/all-exceptions.filter'
import { TransformInterceptor } from './interceptors/transform.interceptor'
import { VerifiedUserGuard } from './guards/verified-user.guard'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    VerifiedUserGuard,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
  exports: [RedisService, VerifiedUserGuard],
})
export class CommonModule {}
