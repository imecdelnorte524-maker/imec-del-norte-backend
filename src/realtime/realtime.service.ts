// src/realtime/realtime.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WorkOrderLightDto } from '../work-orders/dto/work-order-light.dto';
import { NotificationLightDto } from '../notifications/dto/notification-light.dto';

export type EntityAction = 'created' | 'updated' | 'deleted';

@Injectable()
export class RealtimeService {
  private server: Server;
  private readonly logger = new Logger(RealtimeService.name);

  // Cache para evitar duplicados
  private lastEmitted = new Map<string, { payload: any; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 5 segundos

  setServer(server: Server) {
    this.server = server;
    this.logger.log('✅ Servidor WebSocket asignado a RealtimeService');
  }

  /**
   * Verificar si un evento ya fue emitido recientemente (para evitar duplicados)
   */
  private shouldEmit(event: string, payload: any): boolean {
    const key = `${event}:${JSON.stringify(payload)}`;
    const last = this.lastEmitted.get(key);
    const now = Date.now();

    if (last && now - last.timestamp < this.CACHE_TTL) {
      return false;
    }

    this.lastEmitted.set(key, { payload, timestamp: now });

    // Limpiar cache viejo
    if (this.lastEmitted.size > 100) {
      const oldest = now - this.CACHE_TTL;
      for (const [k, v] of this.lastEmitted.entries()) {
        if (v.timestamp < oldest) {
          this.lastEmitted.delete(k);
        }
      }
    }

    return true;
  }

  /**
   * Emitir a TODOS los clientes conectados
   */
  emitGlobal(event: string, payload?: any) {
    if (!this.server) {
      this.logger.warn('⚠️ Servidor WebSocket no disponible');
      return;
    }

    // Estimar tamaño del payload
    const size = JSON.stringify(payload).length;
    if (size > 500 * 1024) {
      // 500KB
      this.logger.warn(
        `⚠️ Payload muy grande: ${Math.round(size / 1024)}KB para evento ${event}`,
      );
    }

    this.server.emit(event, {
      ...payload,
      _timestamp: Date.now(),
    });

    this.logger.debug(
      `📡 Evento global emitido: ${event} (${Math.round(size / 1024)}KB)`,
    );
  }

  /**
   * Emitir a un usuario específico (por su ID)
   */
  emitToUser(userId: number | string, event: string, payload?: any) {
    if (!this.server) {
      this.logger.warn('⚠️ Servidor WebSocket no disponible');
      return;
    }

    const room = `user:${userId}`;
    this.server.to(room).emit(event, {
      ...payload,
      _timestamp: Date.now(),
    });

    this.logger.debug(`📡 Evento emitido a usuario ${userId}: ${event}`);
  }

  /**
   * Emitir a múltiples usuarios
   */
  emitToUsers(userIds: (number | string)[], event: string, payload?: any) {
    if (!this.server || !userIds.length) return;

    userIds.forEach((userId) => {
      const room = `user:${userId}`;
      this.server.to(room).emit(event, {
        ...payload,
        _timestamp: Date.now(),
      });
    });

    this.logger.debug(
      `📡 Evento emitido a ${userIds.length} usuarios: ${event}`,
    );
  }

  /**
   * Emitir actualización de entidad (para listas/tablas)
   */
  emitEntityUpdate(entity: string, action: EntityAction, data?: any) {
    if (!this.server) return;

    // Para workOrders, usar versión ligera
    if (entity === 'workOrders' && data) {
      data = WorkOrderLightDto.forBroadcast(data);
    }

    const payload = {
      entity,
      action,
      data,
      timestamp: Date.now(),
    };

    this.server.emit('entity.updated', payload);
    this.logger.debug(`📡 Entidad actualizada: ${entity} - ${action}`);
  }

  /**
   * Emitir actualización de detalle de entidad (para vistas detalle)
   */
  emitEntityDetail(
    entity: string,
    entityId: number | string,
    action: EntityAction,
    data?: any,
  ) {
    if (!this.server) return;

    const room = `${entity}:${entityId}`;
    this.server.to(room).emit('entity.detail.updated', {
      entity,
      entityId,
      action,
      data,
      timestamp: Date.now(),
    });

    this.logger.debug(
      `📡 Detalle de entidad actualizado: ${entity}:${entityId} - ${action}`,
    );
  }

  /**
   * Emitir notificación a usuario (versión ligera)
   */
  emitNotification(userId: number, notification: any) {
    const lightNotif = NotificationLightDto.fromEntity(notification);
    this.emitToUser(userId, 'notification', { notification: lightNotif });
  }

  /**
   * Forzar actualización de contador de notificaciones no leídas
   */
  emitUnreadCount(userId: number, total: number) {
    this.emitToUser(userId, 'unread-count', { total });
  }

  /**
   * Emitir evento de workOrders actualizado (versión ligera)
   */
  emitWorkOrderUpdate(
    workOrder: any,
    action: 'created' | 'updated' | 'deleted' = 'updated',
  ) {
    if (!workOrder) return;

    // Versión ultra ligera para broadcasts
    const lightWorkOrder = WorkOrderLightDto.forBroadcast(workOrder);

    // Evitar duplicados
    if (!this.shouldEmit(`workOrders.${action}`, lightWorkOrder)) {
      return;
    }

    // Emitir globalmente (versión ligera)
    this.emitEntityUpdate('workOrders', action, lightWorkOrder);
    this.emitGlobal(`workOrders.${action}`, lightWorkOrder);

    // Emitir a la sala específica de la orden (versión completa)
    if (workOrder.ordenId) {
      this.emitEntityDetail('workOrder', workOrder.ordenId, action, workOrder);
    }

    // Si hay cliente, emitirle versión ligera
    if (workOrder.clienteId) {
      this.emitToUser(
        workOrder.clienteId,
        'workOrders.client.updated',
        lightWorkOrder,
      );
    }
  }

  /**
   * Emitir evento de cambio de estado de workOrder
   */
  emitWorkOrderStatusUpdate(workOrder: any, previousStatus: string) {
    if (!this.server || !workOrder) return;

    const payload = {
      ordenId: workOrder.ordenId,
      previousStatus,
      newStatus: workOrder.estado,
      timestamp: Date.now(),
    };

    // Evitar duplicados
    if (!this.shouldEmit('workOrders.statusUpdated', payload)) {
      return;
    }

    this.emitGlobal('workOrders.statusUpdated', payload);

    if (workOrder.ordenId) {
      this.emitEntityDetail(
        'workOrder',
        workOrder.ordenId,
        'updated',
        workOrder,
      );
    }

    this.logger.debug(
      `📡 Cambio de estado workOrder ${workOrder.ordenId}: ${previousStatus} -> ${workOrder.estado}`,
    );
  }

  /**
   * Emitir evento de workOrder asignada (versión ligera)
   */
  emitWorkOrderAssigned(
    workOrder: any,
    technicianIds: number[],
    leaderTechnicianId?: number,
  ) {
    if (!workOrder) return;

    const payload = {
      ordenId: workOrder.ordenId,
      technicianIds,
      leaderTechnicianId,
      timestamp: Date.now(),
    };

    // Evitar duplicados
    if (!this.shouldEmit('workOrders.assigned', payload)) {
      return;
    }

    // Emitir a TODOS (versión ligera)
    this.emitGlobal('workOrders.assigned', payload);

    // También emitir a los técnicos específicos
    this.emitToUsers(technicianIds, 'workOrders.assigned', payload);

    // Emitir actualización de entidad ligera
    this.emitEntityUpdate(
      'workOrders',
      'updated',
      WorkOrderLightDto.forBroadcast(workOrder),
    );
  }

  /**
   * Emitir evento de factura actualizada
   */
  emitInvoiceUpdate(workOrderId: number, invoiceData: any) {
    this.emitGlobal('workOrders.invoiceUpdated', {
      workOrderId,
      ...invoiceData,
      timestamp: Date.now(),
    });
  }

  /**
   * Emitir evento de factura eliminada
   */
  emitInvoiceRemoved(workOrderId: number) {
    this.emitGlobal('workOrders.invoiceRemoved', {
      workOrderId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emitir evento de técnicos calificados
   */
  emitTechniciansRated(ordenId: number) {
    this.emitGlobal('workOrders.techniciansRated', {
      ordenId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emitir evento de firma de recibido
   */
  emitReceiptSigned(ordenId: number, workOrder: any) {
    this.emitGlobal('workOrders.receiptSigned', {
      ordenId,
      workOrder: WorkOrderLightDto.forBroadcast(workOrder),
      timestamp: Date.now(),
    });
  }

  /**
   * Emitir evento de orden de emergencia creada
   */
  emitEmergencyCreated(originalOrderId: number, emergencyOrder: any) {
    this.emitGlobal('workOrders.emergencyCreated', {
      originalOrderId,
      emergencyOrder: WorkOrderLightDto.forBroadcast(emergencyOrder),
      timestamp: Date.now(),
    });
  }

  /**
   * Obtener estadísticas de uso
   */
  getStats() {
    return {
      cacheSize: this.lastEmitted.size,
      memoryUsage: process.memoryUsage(),
    };
  }
}
