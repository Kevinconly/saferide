import { Global, Module } from '@nestjs/common'
import { RealtimeService } from './realtime.service'
import { SocketGateway } from './socket.gateway'

@Global()
@Module({
  providers: [RealtimeService, SocketGateway],
  exports: [RealtimeService],
})
export class WebsocketModule {}
