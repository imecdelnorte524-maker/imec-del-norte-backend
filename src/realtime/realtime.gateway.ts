import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private userSockets = new Map<number, Set<string>>();
  private socketToUser = new Map<string, number>();

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    // Middleware de autenticación
    server.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        socket.data.userId = payload.sub;
        next();
      } catch (error) {
        this.logger.error(`Error de autenticación: ${error.message}`);
        return next(new Error('Unauthorized'));
      }
    });

    this.realtime.setServer(server);
    this.logger.log('✅ Realtime Gateway iniciado con auth middleware');
  }

  async handleConnection(client: Socket) {
    const userId: number = client.data.userId;

    try {
      // Registrar socket
      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client.id);
      this.socketToUser.set(client.id, userId);

      // Unirse a salas personales
      client.join(`user:${userId}`);
      
      // Unirse a sala general
      client.join('global');

      this.logger.log(`🔌 Usuario ${userId} conectado: ${client.id}`);
    } catch (error) {
      this.logger.error('Error en conexión:', error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketToUser.delete(client.id);
    }
    
    this.logger.log(`❌ Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('join')
  joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() room: string) {
    socket.join(room);
    this.logger.log(`📌 Socket ${socket.id} unido a sala: ${room}`);
  }

  @SubscribeMessage('leave')
  leaveRoom(@ConnectedSocket() socket: Socket, @MessageBody() room: string) {
    socket.leave(room);
    this.logger.log(`📌 Socket ${socket.id} salió de sala: ${room}`);
  }

  @SubscribeMessage('join-user-room')
  joinUserRoom(@ConnectedSocket() socket: Socket, @MessageBody() userId: number) {
    const currentUserId = socket.data.userId;
    if (currentUserId === userId) {
      socket.join(`user:${userId}`);
      this.logger.log(`📌 Usuario ${currentUserId} unido a su sala personal`);
    }
  }

  // Métodos públicos para obtener información de sockets (útiles para debugging)
  getSocketCount(): number {
    return this.socketToUser.size;
  }

  getUserSockets(userId: number): Set<string> | undefined {
    return this.userSockets.get(userId);
  }

  isUserOnline(userId: number): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }
}