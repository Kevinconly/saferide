import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { OutboxModule } from '../outbox/outbox.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [OutboxModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
