// notifications/notifications.gateway.ts
import {
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
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
        this.logger.warn('⚠️ Conexión rechazada: Token no proporcionado');
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
      this.socketToUser.set(client.id, userId);
      client.join(`user:${userId}`);

      // Enviar conteo inicial de no leídas
      const unreadCount = await this.notificationsRepo.count({
        where: { usuarioId: userId, leida: false },
      });

      client.emit('unread-count', {
        total: unreadCount,
        timestamp: new Date().toISOString(),
      });

      client.emit('connected', {
        userId,
        socketId: client.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Usuario ${userId} conectado (socket: ${client.id})`);
      this.logger.debug(`📊 Usuarios conectados: ${this.userSockets.size}`);
    } catch (error) {
      this.logger.error('❌ Error en conexión WebSocket:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = this.socketToUser.get(client.id);

      if (userId) {
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
        this.socketToUser.delete(client.id);
        this.logger.log(
          `❌ Usuario ${userId} desconectado (socket: ${client.id})`,
        );
      } else {
        this.logger.log(`❓ Socket desconocido desconectado: ${client.id}`);
      }

      client.leave(`user:${userId}`);
    } catch (error) {
      this.logger.error('Error en handleDisconnect:', error.message);
    }
  }

  /**
   * Envía una notificación a un usuario específico
   * @param usuarioId ID del usuario destino
   * @param notification Notificación a enviar
   * @param excludeSocketId Socket ID a excluir (opcional, para no duplicar)
   */
  sendToUser(
    usuarioId: number,
    notification: Notification,
    excludeSocketId?: string,
  ) {
    const sockets = this.userSockets.get(usuarioId);

    if (!sockets || sockets.size === 0) {
      this.logger.debug(
        `📭 Usuario ${usuarioId} no está conectado. Notificación #${notification.notificacionId} guardada para entrega posterior.`,
      );
      return;
    }

    this.logger.log(
      `📤 Enviando notificación #${notification.notificacionId} a usuario ${usuarioId} (${sockets.size} sockets activos)`,
    );

    // Enviar al room, excluyendo el socket especificado si se proporciona
    if (excludeSocketId) {
      // Enviar a todos menos al excluido
      sockets.forEach((socketId) => {
        if (socketId !== excludeSocketId) {
          this.server.to(socketId).emit('notification', {
            ...notification,
            _timestamp: new Date().toISOString(),
            _deliveredTo: socketId,
          });
        }
      });
    } else {
      // Enviar a todos en el room
      this.server.to(`user:${usuarioId}`).emit('notification', {
        ...notification,
        _timestamp: new Date().toISOString(),
      });
    }

    // Actualizar conteo de no leídas
    this.updateUnreadCount(usuarioId, excludeSocketId);
  }

  /**
   * Envía una notificación asegurando que el socket actual la recibe
   * @param usuarioId ID del usuario
   * @param notification Notificación a enviar
   * @param currentSocketId Socket ID actual (opcional)
   */
  sendToUserIncludingCurrent(
    usuarioId: number,
    notification: Notification,
    currentSocketId?: string,
  ) {
    const sockets = this.userSockets.get(usuarioId);

    if (!sockets || sockets.size === 0) {
      this.logger.debug(`📭 Usuario ${usuarioId} no está conectado.`);

      // Si hay socket actual pero no está en el mapa, intentar enviar directamente
      if (currentSocketId) {
        const currentSocket = this.server.sockets.sockets.get(currentSocketId);
        if (currentSocket) {
          this.logger.log(
            `📤 Enviando notificación #${notification.notificacionId} directamente al socket ${currentSocketId}`,
          );
          currentSocket.emit('notification', {
            ...notification,
            _timestamp: new Date().toISOString(),
            _deliveredDirectly: true,
          });

          // Actualizar conteo para este socket
          this.notificationsRepo
            .count({ where: { usuarioId, leida: false } })
            .then((count) => {
              currentSocket.emit('unread-count', {
                total: count,
                timestamp: new Date().toISOString(),
              });
            });
        }
      }
      return;
    }

    this.logger.log(
      `📤 Enviando notificación #${notification.notificacionId} a usuario ${usuarioId} (incluyendo socket actual)`,
    );

    // Enviar a todos los sockets del usuario
    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification', {
        ...notification,
        _timestamp: new Date().toISOString(),
      });
    });

    // Actualizar conteo para todos los sockets
    this.updateUnreadCount(usuarioId);
  }

  /**
   * Actualiza el conteo de notificaciones no leídas para un usuario
   */
  private async updateUnreadCount(usuarioId: number, excludeSocketId?: string) {
    try {
      const count = await this.notificationsRepo.count({
        where: { usuarioId: usuarioId, leida: false },
      });

      const sockets = this.userSockets.get(usuarioId);
      if (sockets) {
        sockets.forEach((socketId) => {
          if (!excludeSocketId || socketId !== excludeSocketId) {
            this.server.to(socketId).emit('unread-count', {
              total: count,
              timestamp: new Date().toISOString(),
            });
          }
        });
      }
    } catch (error) {
      this.logger.error('Error al actualizar conteo de no leídas:', error);
    }
  }

  sendToMultipleUsers(
    usuariosIds: number[],
    notification: Notification,
    excludeUserId?: number,
  ) {
    this.logger.debug(
      `📤 Enviando notificación a ${usuariosIds.length} usuarios`,
    );
    usuariosIds.forEach((id) => {
      if (id !== excludeUserId) {
        this.sendToUser(id, notification);
      }
    });
  }

  async broadcastToRole(role: string, notification: Notification) {
    this.logger.warn(
      `⚠️ broadcastToRole no implementado completamente: ${role}`,
    );
  }

  getConnectedUsers(): number[] {
    return Array.from(this.userSockets.keys());
  }

  isUserConnected(usuarioId: number): boolean {
    const sockets = this.userSockets.get(usuarioId);
    return sockets ? sockets.size > 0 : false;
  }

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

  /**
   * Obtiene el ID del socket actual si está conectado
   */
  getSocketIdForUser(usuarioId: number): string | null {
    const sockets = this.userSockets.get(usuarioId);
    if (sockets && sockets.size > 0) {
      // Devuelve el primer socket (generalmente el más reciente)
      return Array.from(sockets)[0];
    }
    return null;
  }
}
