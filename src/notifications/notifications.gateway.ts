// notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'notifications',
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<number, Set<string>>();

  // Mapa para almacenar el userId asociado a cada socketId
  private socketToUser = new Map<string, number>();

  private jwtService: JwtService;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
  ) {
    this.jwtService = new JwtService({
      secret: this.configService.get<string>('JWT_SECRET'),
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('Cliente sin token, desconectando');
        return client.disconnect();
      }

      const payload = this.jwtService.verify(token);
      const userId: number = payload.sub;

      // Registrar socket
      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client.id);

      // Registrar relación socket -> usuario
      this.socketToUser.set(client.id, userId);

      // Unir al room del usuario
      client.join(`user:${userId}`);

      // Enviar conteo inicial de no leídas
      const unreadCount = await this.notificationsRepo.count({
        where: { usuarioId: userId, leida: false },
      });

      client.emit('unread-count', unreadCount);
      client.emit('connected', { userId, timestamp: new Date() });

      this.logger.log(`✅ Usuario ${userId} conectado (socket: ${client.id})`);
    } catch (error) {
      this.logger.error('Error en conexión WebSocket:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  // CORREGIDO: Ahora solo recibe el client como parámetro
  async handleDisconnect(client: Socket) {
    try {
      // Obtener userId del mapa
      const userId = this.socketToUser.get(client.id);

      if (userId) {
        // Eliminar del mapa de sockets por usuario
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(client.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
            this.logger.log(
              `👤 Usuario ${userId} ya no tiene sockets conectados`,
            );
          }
        }

        // Eliminar del mapa de socket->usuario
        this.socketToUser.delete(client.id);

        this.logger.log(
          `❌ Usuario ${userId} desconectado (socket: ${client.id})`,
        );
      } else {
        this.logger.log(`❓ Socket desconocido desconectado: ${client.id}`);
      }

      // Salir del room
      client.leave(`user:${userId}`);
    } catch (error) {
      this.logger.error('Error en handleDisconnect:', error.message);
    }
  }

  sendToUser(usuarioId: number, notification: Notification) {
    const sockets = this.userSockets.get(usuarioId);
    if (!sockets || sockets.size === 0) {
      this.logger.debug(`📭 Usuario ${usuarioId} no está conectado`);
      return;
    }

    this.logger.debug(
      `📤 Enviando notificación a usuario ${usuarioId} (${sockets.size} sockets)`,
    );

    // Enviar la notificación
    this.server.to(`user:${usuarioId}`).emit('notification', {
      ...notification,
      _timestamp: new Date().toISOString(),
    });

    // Enviar nuevo conteo
    this.notificationsRepo
      .count({
        where: { usuarioId: usuarioId, leida: false },
      })
      .then((count) => {
        this.server.to(`user:${usuarioId}`).emit('unread-count', {
          total: count,
          timestamp: new Date().toISOString(),
        });
      })
      .catch((error) => {
        this.logger.error('Error al obtener conteo de no leídas:', error);
      });
  }

  sendToMultipleUsers(usuariosIds: number[], notification: Notification) {
    this.logger.debug(
      `📤 Enviando notificación a ${usuariosIds.length} usuarios`,
    );
    usuariosIds.forEach((id) => this.sendToUser(id, notification));
  }

  // Método para broadcast por rol (requiere implementación adicional)
  async broadcastToRole(role: string, notification: Notification) {
    // Esta implementación requeriría consultar usuarios por rol
    // y luego enviar a cada uno
    this.logger.warn(
      `⚠️ broadcastToRole no implementado completamente: ${role}`,
    );

    // Ejemplo de implementación:
    // const users = await this.userRepo.find({ where: { role: { nombre: role } } });
    // this.sendToMultipleUsers(users.map(u => u.usuarioId), notification);
  }

  // Método útil para verificar conexiones activas
  getConnectedUsers(): number[] {
    return Array.from(this.userSockets.keys());
  }

  // Método para verificar si un usuario está conectado
  isUserConnected(usuarioId: number): boolean {
    const sockets = this.userSockets.get(usuarioId);
    return sockets ? sockets.size > 0 : false;
  }

  // Método para obtener estadísticas de conexión
  getConnectionStats() {
    return {
      totalUsers: this.userSockets.size,
      totalSockets: this.socketToUser.size,
      users: Array.from(this.userSockets.entries()).map(
        ([userId, sockets]) => ({
          userId,
          socketCount: sockets.size,
          sockets: Array.from(sockets),
        }),
      ),
    };
  }
}
