import { Module } from '@nestjs/common'
import { OutboxService } from './outbox.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
