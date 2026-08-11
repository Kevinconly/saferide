import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { AdminService } from './admin.service'
import { AdminRefundDto, RejectDriverDto, UpdateUserStatusDto } from './dto/admin.dto'

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  async stats() {
    return this.admin.stats()
  }

  @Get('users')
  async listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.admin.listUsers(p, ps, search)
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.admin.getUser(id)
  }

  @Patch('users/:id/status')
  async setUserStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.setUserStatus(user.userId, id, dto.status)
  }

  @Get('drivers')
  async listDrivers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.admin.listDrivers(p, ps, search)
  }

  @Get('drivers/:id')
  async getDriver(@Param('id') id: string) {
    return this.admin.getDriver(id)
  }

  @Post('drivers/:id/approve')
  async approveDriver(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.approveDriver(user.userId, id)
  }

  @Post('drivers/:id/reject')
  async rejectDriver(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectDriverDto,
  ) {
    return this.admin.rejectDriver(user.userId, id, dto.reason)
  }

  @Get('rides')
  async listRides(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('state') state?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.admin.listRides(p, ps, state, search)
  }

  @Get('rides/:id')
  async getRide(@Param('id') id: string) {
    return this.admin.getRide(id)
  }

  @Get('payments')
  async listPayments(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.admin.listPayments(p, ps, status)
  }

  @Post('payments/:id/refund')
  async refundPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminRefundDto,
  ) {
    return this.admin.refundPayment(user.userId, id, dto.reason)
  }

  @Get('audit-logs')
  async listAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.admin.listAuditLogs(p, ps, actorId, action)
  }
}
