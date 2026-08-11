import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard'
import type { AuthUser } from '../../common/types/auth-user'
import { RidesService } from './rides.service'
import { CancelRideDto, CreateRideDto, FareEstimateQueryDto } from './dto/ride.dto'

@ApiTags('rides')
@ApiBearerAuth()
@Roles('PASSENGER')
@UseGuards(VerifiedUserGuard)
@Controller('rides')
export class RidesController {
  constructor(private rides: RidesService) {}

  @Post()
  async request(@CurrentUser() user: AuthUser, @Body() dto: CreateRideDto) {
    return this.rides.requestRide(user.userId, dto)
  }

  @Get()
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.rides.listMine(user.userId, p, ps)
  }

  @Get('current')
  async current(@CurrentUser() user: AuthUser) {
    return this.rides.currentForPassenger(user.userId)
  }

  @Get('fare-estimate')
  async fareEstimate(@Query() query: FareEstimateQueryDto) {
    return this.rides.fareEstimate({
      lat1: query.pickupLat,
      lng1: query.pickupLng,
      lat2: query.dropoffLat,
      lng2: query.dropoffLng,
    })
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rides.getById(user.userId, id, user.role)
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelRideDto) {
    return this.rides.cancel(user.userId, id, dto.reason)
  }
}
