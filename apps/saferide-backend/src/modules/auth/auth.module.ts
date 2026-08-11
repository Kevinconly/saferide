import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OtpService } from './otp.service'
import { TokenService } from './token.service'
import { AuditModule } from '../audit/audit.module'
import { AuthSeedService } from './auth-seed.service'

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, AuthSeedService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
