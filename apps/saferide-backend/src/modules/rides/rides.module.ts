import { Module } from '@nestjs/common'
import { RidesService } from './rides.service'
import { RidesController } from './rides.controller'
import { DriverRidesController } from './driver-rides.controller'
import { DispatchService } from './dispatch.service'
import { OutboxModule } from '../outbox/outbox.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [OutboxModule, NotificationsModule, AuditModule],
  controllers: [DriverRidesController, RidesController],
  providers: [RidesService, DispatchService],
  exports: [RidesService],
})
export class RidesModule {}
