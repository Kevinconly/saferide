import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../../config/config.service';
import { RealtimeService } from './realtime.service';
import { Server, Socket } from 'socket.io';

interface SocketUser {
  userId: string;
  role: string;
}

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('SocketGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private realtime: RealtimeService,
  ) {}

  handleConnection(socket: Socket): void {
    const user = this.authenticate(socket);
    if (!user) {
      socket.emit('auth:error', { message: 'Unauthorized' });
      socket.disconnect(true);
      return;
    }

    socket.data.user = user;
    socket.join(`user:${user.userId}`);
    if (user.role === 'DRIVER') {
      socket.join(`drivers`);
    }
    this.realtime.setServer(this.server);
    this.logger.log(`Socket connected: user ${user.userId}`);
  }

  handleDisconnect(socket: Socket): void {
    const user = socket.data?.user as SocketUser | undefined;
    if (user) {
      this.logger.log(`Socket disconnected: user ${user.userId}`);
    }
  }

  private authenticate(socket: Socket): SocketUser | null {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return null;
      const payload = this.jwt.verify<{ sub: string; role: string }>(token, {
        secret: this.config.get('JWT_ACCESS_TOKEN_SECRET'),
      });
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }
}
