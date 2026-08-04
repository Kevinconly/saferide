import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../config/config.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { AuthUser } from '../types/auth-user'

export interface JwtPayload {
  sub: string
  role: string
  phone?: string
  email?: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const authHeader: string | undefined = request.headers?.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const token = authHeader.slice(7)
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get('JWT_ACCESS_TOKEN_SECRET'),
      })
      request.user = {
        userId: payload.sub,
        role: payload.role,
        phone: payload.phone,
        email: payload.email,
      } satisfies AuthUser
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
