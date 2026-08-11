import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { PaymentsService } from './payments.service'
import { InitiatePaymentDto, RefundPaymentDto, SandboxWebhookDto } from './dto/payment.dto'

@ApiTags('payments')
@ApiBearerAuth()
@Roles('PASSENGER')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('initiate')
  async initiate(@CurrentUser() user: AuthUser, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiateForRide(user.userId, dto.rideId, dto.idempotencyKey)
  }

  @Post(':id/simulate-success')
  async simulateSuccess(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.simulateSuccess(id)
  }

  @Post(':id/refund')
  async refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.payments.refund(user.userId, id, dto.reason)
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.payments.listMine(user.userId, p, ps)
  }

  @Get('ride/:rideId')
  async byRide(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.payments.getByRide(user.userId, rideId)
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getById(user.userId, id, user.role)
  }

  @Public()
  @Post('webhooks/sandbox')
  async webhookSandbox(
    @Body() dto: SandboxWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    return this.payments.webhookSandbox(dto.paymentId, secret)
  }
}
