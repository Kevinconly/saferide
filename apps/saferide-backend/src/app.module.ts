import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from './config/config.module'
import { ConfigService } from './config/config.service'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { LoggingModule } from './logging/logging.module'
import { CommonModule } from './common/common.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { RidesModule } from './modules/rides/rides.module'
import { WebsocketModule } from './modules/websocket/websocket.module'
import { OutboxModule } from './modules/outbox/outbox.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { AdminModule } from './modules/admin/admin.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_TOKEN_SECRET'),
      }),
    }),
    LoggingModule,
    PrismaModule,
    CommonModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RidesModule,
    WebsocketModule,
    OutboxModule,
    NotificationsModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
