import { Module } from '@nestjs/common'
import { AdminService } from './admin.service'
import { AdminController } from './admin.controller'
import { RidesModule } from '../rides/rides.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [RidesModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
