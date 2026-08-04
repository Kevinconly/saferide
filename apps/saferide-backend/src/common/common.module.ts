import { Global, Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from '../config/config.module'
import { RedisService } from './redis.service'
import { AllExceptionsFilter } from './filters/all-exceptions.filter'
import { TransformInterceptor } from './interceptors/transform.interceptor'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
  exports: [RedisService],
})
export class CommonModule {}
