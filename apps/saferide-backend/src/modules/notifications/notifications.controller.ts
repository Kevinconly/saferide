import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { NotificationService } from './notification.service'
import { RegisterSubscriptionDto, RemoveSubscriptionDto } from './dto/notification.dto'

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationService) {}

  @Post('subscriptions')
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.notifications.registerSubscription({
      userId: user.userId,
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: req.headers['user-agent'] ?? undefined,
    })
  }

  @Delete('subscriptions')
  async remove(@CurrentUser() user: AuthUser, @Query('endpoint') endpoint: string) {
    return this.notifications.removeSubscription(user.userId, endpoint)
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.notifications.list(user.userId, p, ps)
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id)
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.userId)
  }
}
