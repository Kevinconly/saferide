import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user || !user.userId) {
      throw new ForbiddenException('Authentication required')
    }

    const existing = await this.prisma.user.findUnique({ where: { id: user.userId } })
    if (!existing) {
      throw new ForbiddenException('Authentication required')
    }

    if (existing.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active')
    }

    if (!existing.isVerified) {
      throw new ForbiddenException('Account not verified. Please verify your phone before booking rides.')
    }

    return true
  }
}
