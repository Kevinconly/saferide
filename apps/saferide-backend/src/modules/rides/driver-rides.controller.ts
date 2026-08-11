import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { RidesService } from './rides.service'
import { AcceptRideDto, RejectRideDto, UpdateRideStatusDto } from './dto/ride.dto'

@ApiTags('rides')
@ApiBearerAuth()
@Roles('DRIVER')
@Controller('rides/driver')
export class DriverRidesController {
  constructor(private rides: RidesService) {}

  @Get('current')
  async current(@CurrentUser() user: AuthUser) {
    const driverId = await this.requireDriverId(user.userId)
    return this.rides.currentForDriver(driverId)
  }

  @Get()
  async history(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const driverId = await this.requireDriverId(user.userId)
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '20', 10) || 20))
    return this.rides.listForDriver(driverId, p, ps)
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AcceptRideDto) {
    const driverId = await this.requireDriverId(user.userId)
    return this.rides.acceptRide(driverId, id, dto.offerId)
  }

  @Post(':id/reject')
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectRideDto) {
    const driverId = await this.requireDriverId(user.userId)
    return this.rides.rejectRide(driverId, id, dto.offerId)
  }

  @Post(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRideStatusDto,
  ) {
    const driverId = await this.requireDriverId(user.userId)
    return this.rides.updateState(driverId, id, dto.newState)
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rides.getById(user.userId, id, user.role)
  }

  private async requireDriverId(userId: string): Promise<string> {
    const driver = await this.rides.findDriverByUserId(userId)
    if (!driver) throw new NotFoundException('Driver profile not found')
    return driver.id
  }
}
