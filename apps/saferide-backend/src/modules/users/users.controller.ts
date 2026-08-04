import { Body, Controller, Get, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { UsersService } from './users.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId)
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto)
  }

  @Get('me/rides')
  async rideHistory(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1)
    const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '10', 10) || 10))
    return this.users.getRideHistory(user.userId, p, ps)
  }
}
