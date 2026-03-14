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
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
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

  private failedAttempts = new Map<
    string,
    { count: number; lastAttempt: Date }
  >();
  private readonly MAX_FAILED_ATTEMPTS = 2;
  private readonly BLOCK_DURATION = 5 * 60 * 1000;

  private ipConnections = new Map<string, Set<string>>();
  private readonly MAX_CONNECTIONS_PER_IP = 5;

  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🧹 Limpiando conexiones WebSocket existentes...');

    try {
      server.sockets?.sockets?.forEach((socket) => {
        socket.emit('server_restart', 'Servidor reiniciado. Reconectando...');
        socket.disconnect(true);
      });
    } catch (error) {
      this.logger.error('Error limpiando sockets:', error);
    }

    this.userSockets.clear();
    this.socketToUser.clear();
    this.failedAttempts.clear();
    this.ipConnections.clear();

    this.cleanupInterval = setInterval(
      () => {
        this.periodicCleanup();
      },
      30 * 60 * 1000,
    );

    server.use((socket, next) => {
      let clientIp: string;
      const forwardedFor = socket.handshake.headers['x-forwarded-for'];

      if (Array.isArray(forwardedFor)) {
        clientIp = forwardedFor[0];
      } else if (typeof forwardedFor === 'string') {
        clientIp = forwardedFor.split(',')[0].trim();
      } else {
        clientIp = socket.handshake.address || socket.id;
      }

      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      const ipConnections = this.ipConnections.get(clientIp)?.size || 0;
      if (ipConnections >= this.MAX_CONNECTIONS_PER_IP) {
        this.logger.warn(
          `🚫 IP ${clientIp} excedió límite de conexiones (${this.MAX_CONNECTIONS_PER_IP})`,
        );
        return next(new Error('Demasiadas conexiones desde esta IP'));
      }

      const attempts = this.failedAttempts.get(clientIp);
      if (attempts) {
        const timeSinceLastAttempt =
          Date.now() - attempts.lastAttempt.getTime();
        if (
          attempts.count >= this.MAX_FAILED_ATTEMPTS &&
          timeSinceLastAttempt < this.BLOCK_DURATION
        ) {
          const remainingSeconds = Math.ceil(
            (this.BLOCK_DURATION - timeSinceLastAttempt) / 1000,
          );
          this.logger.warn(
            `🚫 IP ${clientIp} bloqueada por ${remainingSeconds}s`,
          );
          return next(
            new Error(
              `Demasiados intentos fallidos. Espere ${remainingSeconds} segundos.`,
            ),
          );
        }

        if (timeSinceLastAttempt >= this.BLOCK_DURATION) {
          this.failedAttempts.delete(clientIp);
        }
      }

      if (!token) {
        this.logger.warn(
          `⚠️ Conexión rechazada: Token no proporcionado - IP: ${clientIp}`,
        );
        this.recordFailedAttempt(clientIp);
        return next(new Error('Token no proporcionado'));
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        socket.data.userId = payload.sub;
        socket.data.clientIp = clientIp;

        if (!this.ipConnections.has(clientIp)) {
          this.ipConnections.set(clientIp, new Set());
        }
        const ipSockets = this.ipConnections.get(clientIp);
        if (ipSockets) {
          ipSockets.add(socket.id);
        }

        this.failedAttempts.delete(clientIp);
        next();
      } catch (error) {
        this.logger.error(
          `❌ Error de autenticación: ${error.message} - IP: ${clientIp}`,
        );
        this.recordFailedAttempt(clientIp);
        return next(new Error('Token inválido'));
      }
    });

    this.realtime.setServer(server);
    this.logger.log(
      '✅ Realtime Gateway iniciado con auth middleware mejorado',
    );
  }

  private recordFailedAttempt(clientIp: string) {
    const current = this.failedAttempts.get(clientIp);
    if (current) {
      current.count += 1;
      current.lastAttempt = new Date();
      this.failedAttempts.set(clientIp, current);

      this.logger.warn(
        `⚠️ Intento fallido ${current.count}/${this.MAX_FAILED_ATTEMPTS} para IP ${clientIp}`,
      );

      if (current.count >= this.MAX_FAILED_ATTEMPTS) {
        this.logger.warn(
          `🚫 IP ${clientIp} BLOQUEADA por ${this.BLOCK_DURATION / 60000} minutos`,
        );
      }
    } else {
      this.failedAttempts.set(clientIp, { count: 1, lastAttempt: new Date() });
      this.logger.warn(`⚠️ Primer intento fallido para IP ${clientIp}`);
    }
  }

  private periodicCleanup() {
    this.logger.log('🧹 Ejecutando limpieza periódica de conexiones...');

    const now = Date.now();
    let cleanedFailed = 0;
    let cleanedIps = 0;

    for (const [ip, data] of this.failedAttempts.entries()) {
      if (now - data.lastAttempt.getTime() > this.BLOCK_DURATION) {
        this.failedAttempts.delete(ip);
        cleanedFailed++;
      }
    }

    for (const [ip, sockets] of this.ipConnections.entries()) {
      const validSockets = new Set<string>();
      sockets.forEach((socketId) => {
        if (this.server.sockets.sockets.has(socketId)) {
          validSockets.add(socketId);
        }
      });

      if (validSockets.size === 0) {
        this.ipConnections.delete(ip);
        cleanedIps++;
      } else {
        this.ipConnections.set(ip, validSockets);
      }
    }

    this.logger.log(
      `✅ Limpieza completada: ${cleanedFailed} IPs fallidas, ${cleanedIps} IPs huérfanas eliminadas`,
    );
  }

  async handleConnection(client: Socket) {
    const userId: number = client.data.userId;
    const clientIp = client.data.clientIp;

    try {
      const existingSockets = this.userSockets.get(userId);
      if (existingSockets && existingSockets.size >= 10) {
        this.logger.warn(
          `⚠️ Usuario ${userId} tiene demasiadas conexiones (${existingSockets.size}). Cerrando la más antigua...`,
        );

        const oldestSocket = Array.from(existingSockets)[0];
        const oldestClient = this.server.sockets.sockets.get(oldestSocket);
        if (oldestClient) {
          oldestClient.emit(
            'force_disconnect',
            'Demasiadas conexiones simultáneas',
          );
          oldestClient.disconnect(true);
        }
        existingSockets.delete(oldestSocket);
      }

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client.id);
      this.socketToUser.set(client.id, userId);

      client.join(`user:${userId}`);
      client.join('global');

      this.logger.log(
        `🔌 Usuario ${userId} conectado: ${client.id} (Total: ${sockets.size}, IP: ${clientIp})`,
      );
    } catch (error) {
      this.logger.error('Error en conexión:', error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    const clientIp = client.data.clientIp;

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        this.logger.log(
          `❌ Cliente ${client.id} desconectado de usuario ${userId}. Quedan ${sockets.size} conexiones`,
        );

        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          this.logger.log(`✅ Usuario ${userId} sin conexiones activas`);
        }
      }
      this.socketToUser.delete(client.id);
    } else {
      this.logger.log(`❌ Cliente desconocido desconectado: ${client.id}`);
    }

    if (clientIp && this.ipConnections.has(clientIp)) {
      const ipSockets = this.ipConnections.get(clientIp);
      if (ipSockets) {
        ipSockets.delete(client.id);
        if (ipSockets.size === 0) {
          this.ipConnections.delete(clientIp);
        }
      }
    }

    client.removeAllListeners();
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
  joinUserRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userId: number,
  ) {
    const currentUserId = socket.data.userId;
    if (currentUserId === userId) {
      socket.join(`user:${userId}`);
      this.logger.log(`📌 Usuario ${currentUserId} unido a su sala personal`);
    }
  }

  @SubscribeMessage('force-disconnect')
  forceDisconnect(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userId: number,
  ) {
    const currentUserId = socket.data.userId;
    if (currentUserId === 1) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        this.logger.log(
          `👮‍♂️ Administrador ${currentUserId} forzando desconexión de usuario ${userId}`,
        );
        sockets.forEach((socketId) => {
          const client = this.server.sockets.sockets.get(socketId);
          if (client) {
            client.emit('force_disconnect', 'Desconectado por administrador');
            client.disconnect(true);
          }
        });
        this.userSockets.delete(userId);
      }
    }
  }

  @SubscribeMessage('get-stats')
  getStats(@ConnectedSocket() socket: Socket) {
    const currentUserId = socket.data.userId;
    if (currentUserId === 1) {
      // 🔥 CORREGIDO: Tipos explícitos para los arrays
      const failedAttemptsArray: Array<{
        ip: string;
        attempts: number;
        lastAttempt: Date;
        blocked: boolean;
      }> = [];
      for (const [ip, data] of this.failedAttempts.entries()) {
        failedAttemptsArray.push({
          ip,
          attempts: data.count,
          lastAttempt: data.lastAttempt,
          blocked: data.count >= this.MAX_FAILED_ATTEMPTS,
        });
      }

      const ipConnectionsArray: Array<{ ip: string; connections: number }> = [];
      for (const [ip, sockets] of this.ipConnections.entries()) {
        ipConnectionsArray.push({
          ip,
          connections: sockets.size,
        });
      }

      return {
        totalConnections: this.socketToUser.size,
        totalUsers: this.userSockets.size,
        failedAttempts: failedAttemptsArray,
        ipConnections: ipConnectionsArray,
      };
    }
    return { error: 'No autorizado' };
  }

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

  getFailedAttemptsStats() {
    const stats: Array<{
      ip: string;
      attempts: number;
      lastAttempt: Date;
      blocked: boolean;
    }> = [];
    for (const [ip, data] of this.failedAttempts.entries()) {
      stats.push({
        ip,
        attempts: data.count,
        lastAttempt: data.lastAttempt,
        blocked: data.count >= this.MAX_FAILED_ATTEMPTS,
      });
    }
    return stats;
  }

  onModuleDestroy() {
    this.logger.log('🧹 Destruyendo RealtimeGateway, limpiando recursos...');
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.server?.sockets?.sockets?.forEach((socket) => {
      socket.disconnect(true);
    });

    this.userSockets.clear();
    this.socketToUser.clear();
    this.failedAttempts.clear();
    this.ipConnections.clear();
  }
}
