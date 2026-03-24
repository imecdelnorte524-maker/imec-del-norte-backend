import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export interface EntityConfig {
  cache?: boolean;
  ttl?: number;
}

@Injectable()
export class RealtimeService {
  private server: Server;
  private readonly logger = new Logger(RealtimeService.name);

  // Cache configurable por entidad
  private entityConfig = new Map<string, EntityConfig>();
  private lastEmitted = new Map<string, { payload: any; timestamp: number }>();
  private readonly DEFAULT_TTL = 5000;

  setServer(server: Server) {
    this.server = server;
    this.logger.log('Servidor WebSocket asignado');
  }

  setEntityConfig(config: Record<string, EntityConfig>) {
    Object.entries(config).forEach(([entity, cfg]) => {
      this.entityConfig.set(entity, cfg);
    });
  }

  private shouldEmit(entity: string, payload: any): boolean {
    const config = this.entityConfig.get(entity);
    if (!config?.cache) return true;

    const key = `${entity}:${JSON.stringify(payload)}`;
    const last = this.lastEmitted.get(key);
    const now = Date.now();
    const ttl = config.ttl || this.DEFAULT_TTL;

    if (last && now - last.timestamp < ttl) {
      return false;
    }

    this.lastEmitted.set(key, { payload, timestamp: now });
    return true;
  }

  /**
   * 🌍 ÚNICO MÉTODO PARA EMITIR A TODOS
   */
  emitGlobal(event: string, payload: any): void {
    if (!this.server) {
      this.logger.warn('Servidor no disponible');
      return;
    }

    const size = JSON.stringify(payload).length;
    if (size > 500 * 1024) {
      this.logger.warn(`Payload grande: ${Math.round(size / 1024)}KB`);
    }

    this.server.emit(event, payload);
    this.logger.debug(`Global: ${event} (${Math.round(size / 1024)}KB)`);
  }

  /**
   * 👤 ÚNICO MÉTODO PARA EMITIR A UN USUARIO
   */
  emitToUser(userId: number | string, event: string, payload: any): void {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, payload);
    this.logger.debug(`A usuario ${userId}: ${event}`);
  }

  /**
   * 👥 ÚNICO MÉTODO PARA EMITIR A MÚLTIPLES USUARIOS
   */
  emitToUsers(userIds: (number | string)[], event: string, payload: any): void {
    if (!this.server || !userIds.length) return;

    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit(event, payload);
    });

    this.logger.debug(`A ${userIds.length} usuarios: ${event}`);
  }

  emitEntityUpdate(
    entity: string,
    action: string,
    data?: any,
    userId?: number,
  ): void {
    if (!this.server) {
      this.logger.warn('⚠️ Servidor no disponible');
      return;
    }

    if (!this.shouldEmit(entity, data)) return;

    // ✅ ESTRUCTURA FIJA para que el cliente siempre pueda leer
    const payload = {
      entity,
      action,
      data: data || {}, // Siempre objeto, nunca undefined
      timestamp: Date.now(),
    };

    this.logger.log(
      `📡 Emitiendo entity.updated: ${entity}.${action} a global`,
    );

    // Siempre a todos
    this.emitGlobal('entity.updated', payload);

    // Al usuario específico si aplica
    if (userId) {
      this.logger.log(
        `📡 Emitiendo entity.updated: ${entity}.${action} a usuario ${userId}`,
      );
      this.emitToUser(userId, 'entity.updated', payload);
    }
  }

  /**
   * 🔍 ÚNICO MÉTODO PARA DETALLES DE ENTIDADES
   */
  emitEntityDetail(
    entity: string,
    entityId: number | string,
    action: string,
    data?: any,
  ): void {
    if (!this.server) return;

    const payload = {
      entity,
      entityId,
      action,
      data,
      timestamp: Date.now(),
    };

    this.server
      .to(`${entity}:${entityId}`)
      .emit('entity.detail.updated', payload);
  }

  /**
   * 📊 Obtener estadísticas
   */
  getStats() {
    return {
      cacheSize: this.lastEmitted.size,
      activeUsers: this.server?.sockets?.adapter?.rooms?.size || 0,
    };
  }
}
