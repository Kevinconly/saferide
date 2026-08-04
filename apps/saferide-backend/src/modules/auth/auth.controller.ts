import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { AuthService } from './auth.service'
import {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp({ phone: dto.phone })
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const result = await this.auth.verifyOtp({
      phone: dto.phone,
      code: dto.code,
      role: dto.role,
      name: dto.name,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })
    return result
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login({
      phone: dto.phone,
      password: dto.password,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })
  }

  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      return await this.auth.refresh(dto.refreshToken)
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto) {
    await this.auth.logout(dto.refreshToken, '')
    return { success: true }
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId)
  }
}
