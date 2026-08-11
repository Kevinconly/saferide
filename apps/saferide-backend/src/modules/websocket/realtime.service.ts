import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'

@Injectable()
export class RealtimeService {
  private server: Server | null = null

  setServer(server: Server): void {
    this.server = server
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.server) return
    this.server.to(`user:${userId}`).emit(event, data)
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.server) return
    this.server.to(room).emit(event, data)
  }

  emitBroadcast(event: string, data: unknown): void {
    if (!this.server) return
    this.server.emit(event, data)
  }
}
