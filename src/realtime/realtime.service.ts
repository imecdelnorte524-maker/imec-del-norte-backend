// src/realtime/realtime.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export type EntityAction = 'created' | 'updated' | 'deleted';

@Injectable()
export class RealtimeService {
  private server: Server;
  private readonly logger = new Logger(RealtimeService.name);

  setServer(server: Server) {
    this.server = server;
    this.logger.log('✅ Servidor WebSocket asignado a RealtimeService');
  }

  /**
   * Emitir a TODOS los clientes conectados
   */
  emitGlobal(event: string, payload?: any) {
    if (!this.server) {
      this.logger.warn('⚠️ Servidor WebSocket no disponible');
      return;
    }

    this.server.emit(event, {
      ...payload,
      _timestamp: Date.now(),
    });

    this.logger.debug(`📡 Evento global emitido: ${event}`);
  }

  /**
   * Emitir a una sala específica
   */
  emitToRoom(room: string, event: string, payload?: any) {
    if (!this.server) {
      this.logger.warn('⚠️ Servidor WebSocket no disponible');
      return;
    }

    this.server.to(room).emit(event, {
      ...payload,
      _timestamp: Date.now(),
    });

    this.logger.debug(`📡 Evento emitido a sala ${room}: ${event}`);
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
    if (!this.server) {
      this.logger.warn('⚠️ Servidor WebSocket no disponible');
      return;
    }

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

    this.server.emit('entity.updated', {
      entity,
      action,
      data,
      timestamp: Date.now(),
    });

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
   * Emitir notificación a usuario
   */
  emitNotification(userId: number, notification: any) {
    this.emitToUser(userId, 'notification', { notification });
  }

  /**
   * Forzar actualización de contador de notificaciones no leídas
   */
  emitUnreadCount(userId: number, total: number) {
    this.emitToUser(userId, 'unread-count', { total });
  }

  /**
   * Emitir evento de workOrders actualizado
   */
  emitWorkOrderUpdate(
    workOrder: any,
    action: 'created' | 'updated' | 'deleted' = 'updated',
  ) {
    // Emitir globalmente
    this.emitEntityUpdate('workOrders', action, workOrder);

    // Emitir evento específico
    this.emitGlobal(`workOrders.${action}`, workOrder);

    // Emitir a la sala específica de la orden
    if (workOrder.ordenId) {
      this.emitEntityDetail('workOrder', workOrder.ordenId, action, workOrder);
    }

    // Si hay cliente, emitirle
    if (workOrder.clienteId) {
      this.emitToUser(
        workOrder.clienteId,
        'workOrders.client.updated',
        workOrder,
      );
    }
  }

  /**
   * Emitir evento de cambio de estado de workOrder
   */
  emitWorkOrderStatusUpdate(workOrder: any, previousStatus: string) {
    if (!this.server) return;

    const payload = {
      workOrder,
      previousStatus,
      newStatus: workOrder.estado,
      timestamp: Date.now(),
    };

    // Emitir a TODOS
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
   * 🔥 CORREGIDO: Emitir evento de workOrder asignada a TODOS
   */
  emitWorkOrderAssigned(
    workOrder: any,
    technicianIds: number[],
    leaderTechnicianId?: number,
  ) {
    const payload = {
      workOrder,
      technicianIds,
      leaderTechnicianId,
    };

    // ✅ Emitir a TODOS los usuarios
    this.emitGlobal('workOrders.assigned', payload);

    // ✅ También emitir a los técnicos específicos (por si acaso)
    this.emitToUsers(technicianIds, 'workOrders.assigned', payload);

    // ✅ Emitir actualización de entidad
    this.emitEntityUpdate('workOrders', 'updated', workOrder);
  }

  /**
   * Emitir evento de factura actualizada
   */
  emitInvoiceUpdate(workOrderId: number, invoiceData: any) {
    this.emitGlobal('workOrders.invoiceUpdated', {
      workOrderId,
      ...invoiceData,
    });
  }

  /**
   * Emitir evento de factura eliminada
   */
  emitInvoiceRemoved(workOrderId: number) {
    this.emitGlobal('workOrders.invoiceRemoved', { workOrderId });
  }

  /**
   * Emitir evento de técnicos calificados
   */
  emitTechniciansRated(ordenId: number) {
    this.emitGlobal('workOrders.techniciansRated', { ordenId });
  }

  /**
   * Emitir evento de firma de recibido
   */
  emitReceiptSigned(ordenId: number, workOrder: any) {
    this.emitGlobal('workOrders.receiptSigned', { ordenId, workOrder });
  }

  /**
   * Emitir evento de orden de emergencia creada
   */
  emitEmergencyCreated(originalOrderId: number, emergencyOrder: any) {
    this.emitGlobal('workOrders.emergencyCreated', {
      originalOrderId,
      emergencyOrder,
    });
  }
}
