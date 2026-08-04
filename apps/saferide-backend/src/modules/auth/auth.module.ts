import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OtpService } from './otp.service'
import { TokenService } from './token.service'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
