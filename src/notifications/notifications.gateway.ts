import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: '*', // en producción pon tu dominio frontend
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private jwtService: JwtService;

  // userId -> set de socketIds
  private userSockets = new Map<number, Set<string>>();

  constructor(private readonly configService: ConfigService) {
    this.jwtService = new JwtService({
      secret:
        this.configService.get<string>('JWT_SECRET') ||
        '74cea9a6578941933dbb555d4fba6b1f', // mismo fallback que JwtStrategy
    });
  }

  async handleConnection(client: Socket) {
    try {
      // Esperamos que el frontend envíe: io(..., { auth: { token: access_token } })
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers.authorization as string | undefined)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        return client.disconnect();
      }

      const payload: any = this.jwtService.verify(token);
      const userId: number = payload.sub; // en tu JWT: sub = usuarioId

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }

      sockets.add(client.id);

      client.on('disconnect', () => {
        const userSockets = this.userSockets.get(userId);
        if (!userSockets) return;
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      });
    } catch (e) {
      client.disconnect();
    }
  }

  sendToUser(usuarioId: number, notification: Notification) {
    const sockets = this.userSockets.get(usuarioId);
    if (!sockets) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('notification', notification);
    }
  }
}