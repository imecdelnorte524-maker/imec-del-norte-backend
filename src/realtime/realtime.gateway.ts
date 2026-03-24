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
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
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
    this.logger.log('Inicializando gateway...');

    // Middleware de autenticación
    server.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Token no proporcionado'));
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        socket.data.userId = payload.sub;
        next();
      } catch (error) {
        return next(new Error('Token inválido'));
      }
    });

    this.realtime.setServer(server);
    this.logger.log('Gateway iniciado correctamente');
  }

  async handleConnection(client: Socket) {
    const userId: number = client.data.userId;

    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(client.id);
    this.socketToUser.set(client.id, userId);

    client.join(`user:${userId}`);
    client.join('global');

    this.logger.log(`Usuario ${userId} conectado: ${client.id}`);
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
  }

  @SubscribeMessage('*')
  handleAllEvents(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { entity, action, payload } = data;

    this.logger.debug(`Evento recibido: ${entity}.${action}`);

    // Aquí puedes agregar lógica específica si es necesario
    // Pero por ahora solo devolvemos confirmación
    return { status: 'ok', entity, action };
  }
}
