// src/notifications/listeners/work-orders-notifications.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationsService } from '../notifications.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotificationType, NotificationModule } from '../../shared/index';

interface WorkOrderCreatedEvent {
  workOrderId: number;
  clienteId: number;
  servicioId: number;
  equipmentIds: number[];
  isEmergency: boolean;
  createdBy?: number;
  userClientId?: number;
}

interface WorkOrderAssignedEvent {
  workOrderId: number;
  technicianIds: number[];
  leaderTechnicianId?: number;
  clienteId: number;
  servicioId: number;
  assignedBy?: number;
}

interface WorkOrderStartedEvent {
  workOrderId: number;
  clienteId: number;
  fechaInicio: Date;
  iniciadoPor: number;
}

interface WorkOrderCompletedEvent {
  workOrderId: number;
  fechaFinalizacion: Date;
  completedBy?: number;
  clienteId: number;
  clienteEmpresaId?: number;
}

interface WorkOrderInvoicedEvent {
  workOrderId: number;
  facturaPdfUrl: string;
  estadoPago: string;
  fechaFacturacion: Date;
  invoicedBy?: number;
}

interface WorkOrderCancelledEvent {
  workOrderId: number;
  clienteId?: number;
  canceladoPor?: number;
}

interface WorkOrderTechniciansRatedEvent {
  ordenId: number;
  ratedBy: number;
}

interface WorkOrderEmergencyCreatedEvent {
  originalOrderId: number;
  emergencyOrderId: number;
  userId: number;
  createdBy?: number;
}

interface StockBelowMinEvent {
  insumoId: number;
  nombre: string;
  cantidadActual: number;
  stockMin: number;
}

@Injectable()
export class WorkOrdersNotificationsListener {
  private readonly logger = new Logger(WorkOrdersNotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtime: RealtimeService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @OnEvent('work-order.created')
  async handleWorkOrderCreated(payload: WorkOrderCreatedEvent) {
    this.logger.log('='.repeat(60));
    this.logger.log(`📢 work-order.created: orden ${payload.workOrderId}`);
    this.logger.log(
      `👤 Creado por usuario: ${payload.createdBy || 'desconocido'}`,
    );

    try {
      // Buscar Administradores y Secretarias activos
      const queryBuilder = this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true');

      const adminsAndSecretaries = await queryBuilder.getMany();

      if (adminsAndSecretaries.length === 0) {
        this.logger.warn('⚠️ No hay Administradores o Secretarias activos');
        return;
      }

      this.logger.log(
        `👥 Creando notificaciones para ${adminsAndSecretaries.length} usuarios`,
      );

      // Verificar si ya existen notificaciones para evitar duplicados
      const existingNotifications = await this.notificationsService.findForUser(
        adminsAndSecretaries[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.workOrderId &&
          n.tipo === NotificationType.WORK_ORDER_CREATED,
      );

      if (alreadyNotified) {
        this.logger.warn(
          `⚠️ Ya existen notificaciones para la orden ${payload.workOrderId}, omitiendo duplicados`,
        );

        // Emitir eventos en tiempo real para actualizar UI
        this.realtime.emitEntityUpdate('workOrders', 'updated', {
          workOrderId: payload.workOrderId,
          isEmergency: payload.isEmergency,
        });

        return;
      }

      // Crear notificaciones en BD
      const notifications = await Promise.all(
        adminsAndSecretaries.map((user) =>
          this.notificationsService.create({
            usuarioId: user.usuarioId,
            tipo: NotificationType.WORK_ORDER_CREATED,
            titulo: payload.isEmergency
              ? '🚨 ORDEN DE EMERGENCIA CREADA'
              : 'Nueva orden de trabajo',
            mensaje: payload.isEmergency
              ? `Se ha creado una orden de EMERGENCIA #${payload.workOrderId}`
              : `Se ha creado una nueva orden #${payload.workOrderId}`,
            mensajeCorto: `Orden #${payload.workOrderId} ${payload.isEmergency ? '🚨' : 'creada'}`,
            data: {
              workOrderId: payload.workOrderId,
              clienteId: payload.clienteId,
              servicioId: payload.servicioId,
              equipmentIds: payload.equipmentIds,
              isEmergency: payload.isEmergency,
              createdBy: payload.createdBy,
            },
            accion: {
              label: 'Ver orden',
              ruta: `/dashboard/work-orders/${payload.workOrderId}`,
            },
          }),
        ),
      );

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...adminsAndSecretaries.map((u) => u.usuarioId),
          ...(payload.createdBy ? [payload.createdBy] : []),
        ]),
      ];

      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir evento de creación a TODOS
      this.realtime.emitWorkOrderUpdate(
        { ordenId: payload.workOrderId, isEmergency: payload.isEmergency },
        'created',
      );

      this.logger.log(
        `✅ Notificaciones enviadas a ${notifications.length} usuarios`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.created: ${error.message}`);
    }
    this.logger.log('='.repeat(60));
  }

  @OnEvent('work-order.assigned')
  async handleWorkOrderAssigned(payload: WorkOrderAssignedEvent) {
    this.logger.log('='.repeat(60));
    this.logger.log(`📢 work-order.assigned: orden ${payload.workOrderId}`);
    this.logger.log(
      `👤 Asignado por usuario: ${payload.assignedBy || 'desconocido'}`,
    );

    if (!payload.technicianIds || payload.technicianIds.length === 0) {
      this.logger.warn('⚠️ Evento assigned sin technicianIds');
      return;
    }

    // NO EXCLUIR al que asignó - TODOS deben recibir
    const technicianIds = payload.technicianIds;

    const technicians = await this.usersRepo.find({
      where: {
        usuarioId: In(technicianIds),
        activo: true,
      },
      relations: ['role'],
    });

    // Filtrar solo técnicos
    const validTechnicians = technicians.filter((t) => {
      const rol = t.role?.nombreRol?.toLowerCase().trim();
      return rol === 'tecnico' || rol === 'técnico';
    });

    if (validTechnicians.length === 0) {
      this.logger.warn('❌ No se encontraron técnicos válidos');
      return;
    }

    this.logger.log(
      `✅ Técnicos válidos: ${validTechnicians.map((t) => t.usuarioId).join(', ')}`,
    );

    const leaderId = payload.leaderTechnicianId;

    // Verificar si ya existen notificaciones para evitar duplicados
    const existingNotifications = await this.notificationsService.findForUser(
      validTechnicians[0].usuarioId,
      {
        onlyUnread: true,
        modulo: NotificationModule.WORK_ORDERS,
        limit: 50,
      },
    );

    const alreadyNotified = existingNotifications.some(
      (n) =>
        n.data?.workOrderId === payload.workOrderId &&
        n.tipo === NotificationType.WORK_ORDER_ASSIGNED,
    );

    if (alreadyNotified) {
      this.logger.warn(
        `⚠️ Ya existen notificaciones para la orden ${payload.workOrderId}, omitiendo duplicados`,
      );

      // Emitir eventos en tiempo real a TODOS
      const workOrderData = {
        workOrderId: payload.workOrderId,
        clienteId: payload.clienteId,
        servicioId: payload.servicioId,
        leaderId: leaderId,
        assignedBy: payload.assignedBy,
      };

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...technicianIds,
          ...(payload.assignedBy ? [payload.assignedBy] : []),
        ]),
      ];

      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      this.realtime.emitWorkOrderAssigned(
        { ordenId: payload.workOrderId },
        technicianIds,
        leaderId,
      );

      return;
    }

    // Crear notificaciones en BD
    const notifications = await Promise.all(
      validTechnicians.map((tech) => {
        const esLider = tech.usuarioId === leaderId;
        return this.notificationsService.create({
          usuarioId: tech.usuarioId,
          tipo: NotificationType.WORK_ORDER_ASSIGNED,
          titulo: esLider
            ? '📋 Eres líder de una nueva orden'
            : 'Nueva orden asignada',
          mensaje: `Se te ha asignado la orden #${payload.workOrderId}${
            esLider ? ' como técnico líder' : ''
          }`,
          mensajeCorto: `Orden #${payload.workOrderId} asignada`,
          data: {
            workOrderId: payload.workOrderId,
            clienteId: payload.clienteId,
            servicioId: payload.servicioId,
            isLeader: esLider,
            leaderId: leaderId,
            assignedBy: payload.assignedBy,
          },
          accion: {
            label: 'Ver mi orden',
            ruta: `/dashboard/technician/work-orders/${payload.workOrderId}`,
          },
        });
      }),
    );

    // 🔥 CORREGIDO: Manejar undefined correctamente
    const allRecipients = [
      ...new Set([
        ...technicianIds,
        ...(payload.assignedBy ? [payload.assignedBy] : []),
      ]),
    ];

    // Enviar en tiempo real a TODOS (incluyendo al que asignó)
    await Promise.all(
      allRecipients.map(async (userId) => {
        const unreadCount =
          await this.notificationsService.getUnreadCount(userId);
        this.realtime.emitToUser(userId, 'unread-count', {
          total: unreadCount,
        });
      }),
    );

    // Emitir evento de asignación a TODOS
    this.realtime.emitWorkOrderAssigned(
      { ordenId: payload.workOrderId },
      technicianIds,
      leaderId,
    );

    this.logger.log(
      `✅ Notificaciones enviadas a ${validTechnicians.length} técnicos`,
    );
    this.logger.log('='.repeat(60));
  }

  @OnEvent('work-order.started')
  async handleWorkOrderStarted(payload: WorkOrderStartedEvent) {
    this.logger.log(`📢 work-order.started: orden ${payload.workOrderId}`);

    try {
      const cliente = await this.usersRepo.findOne({
        where: { usuarioId: payload.clienteId, activo: true },
      });

      if (!cliente) {
        this.logger.warn(`⚠️ Cliente ${payload.clienteId} no encontrado`);
        return;
      }

      // Verificar si ya existe notificación
      const existingNotifications = await this.notificationsService.findForUser(
        cliente.usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 20,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.workOrderId &&
          n.tipo === NotificationType.WORK_ORDER_IN_PROGRESS,
      );

      if (!alreadyNotified) {
        const notification = await this.notificationsService.create({
          usuarioId: cliente.usuarioId,
          tipo: NotificationType.WORK_ORDER_IN_PROGRESS,
          titulo: '🔄 Orden de trabajo en proceso',
          mensaje: `La orden #${payload.workOrderId} ha comenzado a ejecutarse`,
          mensajeCorto: `Orden #${payload.workOrderId} en proceso`,
          data: {
            workOrderId: payload.workOrderId,
            fechaInicio: payload.fechaInicio,
            iniciadoPor: payload.iniciadoPor,
          },
          accion: {
            label: 'Seguir orden',
            ruta: `/dashboard/client/work-orders/${payload.workOrderId}`,
          },
        });

        this.realtime.emitToUser(cliente.usuarioId, 'notification', {
          notification,
        });
      }

      const unreadCount = await this.notificationsService.getUnreadCount(
        cliente.usuarioId,
      );
      this.realtime.emitUnreadCount(cliente.usuarioId, unreadCount);

      // Emitir actualización a TODOS
      this.realtime.emitWorkOrderStatusUpdate(
        { ordenId: payload.workOrderId, estado: 'IN_PROGRESS' },
        'ASSIGNED',
      );

      this.logger.log(
        `✅ Notificación enviada al cliente ${cliente.nombre || ''}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.started: ${error.message}`);
    }
  }

  @OnEvent('work-order.completed')
  async handleWorkOrderCompleted(payload: WorkOrderCompletedEvent) {
    this.logger.log(`📢 work-order.completed: orden ${payload.workOrderId}`);
    this.logger.log(
      `👤 Completado por usuario: ${payload.completedBy || 'desconocido'}`,
    );

    try {
      // Buscar Administradores y Secretarias
      const adminsAndSecretaries = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      // Buscar el cliente
      const cliente = await this.usersRepo.findOne({
        where: { usuarioId: payload.clienteId, activo: true },
      });

      // Preparar destinatarios: admins + secretarias + cliente
      let destinatarios = [...adminsAndSecretaries];

      if (cliente) {
        const yaIncluido = destinatarios.some(
          (u) => u.usuarioId === cliente.usuarioId,
        );
        if (!yaIncluido) {
          destinatarios.push(cliente);
        }
      }

      if (destinatarios.length === 0) {
        this.logger.warn('⚠️ No hay destinatarios para orden finalizada');
        return;
      }

      this.logger.log(
        `👥 Creando notificaciones para ${destinatarios.length} usuarios`,
      );

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        destinatarios[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.workOrderId &&
          n.tipo === NotificationType.WORK_ORDER_COMPLETED,
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          destinatarios.map((user) => {
            const esCliente = user.usuarioId === payload.clienteId;

            return this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.WORK_ORDER_COMPLETED,
              titulo: '✅ Orden de trabajo finalizada',
              mensaje: esCliente
                ? `Tu orden #${payload.workOrderId} ha sido completada`
                : `La orden #${payload.workOrderId} ha sido completada`,
              mensajeCorto: `Orden #${payload.workOrderId} finalizada`,
              data: {
                workOrderId: payload.workOrderId,
                fechaFinalizacion: payload.fechaFinalizacion,
                completedBy: payload.completedBy,
              },
              accion: {
                label: 'Ver orden',
                ruta: esCliente
                  ? `/dashboard/client/work-orders/${payload.workOrderId}`
                  : `/dashboard/work-orders/${payload.workOrderId}`,
              },
            });
          }),
        );
      }

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...destinatarios.map((u) => u.usuarioId),
          ...(payload.completedBy ? [payload.completedBy] : []),
        ]),
      ];

      // Enviar en tiempo real a TODOS
      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir actualización a TODOS
      this.realtime.emitWorkOrderStatusUpdate(
        { ordenId: payload.workOrderId, estado: 'COMPLETED' },
        'IN_PROGRESS',
      );

      this.logger.log(
        `✅ Notificaciones enviadas a ${destinatarios.length} usuarios`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.completed: ${error.message}`);
    }
  }

  @OnEvent('work-order.invoiced')
  async handleWorkOrderInvoiced(payload: WorkOrderInvoicedEvent) {
    this.logger.log(`📢 work-order.invoiced: orden ${payload.workOrderId}`);
    this.logger.log(
      `👤 Facturado por usuario: ${payload.invoicedBy || 'desconocido'}`,
    );

    try {
      const queryBuilder = this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true');

      const adminsAndSecretaries = await queryBuilder.getMany();

      if (adminsAndSecretaries.length === 0) return;

      const estadoPagoTexto =
        payload.estadoPago === 'Pagado' ? '💰 Pagada' : '⏳ Pendiente de pago';

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        adminsAndSecretaries[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.workOrderId &&
          n.tipo === NotificationType.WORK_ORDER_INVOICED,
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          adminsAndSecretaries.map((user) =>
            this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.WORK_ORDER_INVOICED,
              titulo: '💰 Orden facturada',
              mensaje: `La orden #${payload.workOrderId} ha sido facturada. ${estadoPagoTexto}`,
              mensajeCorto: `Orden #${payload.workOrderId} facturada`,
              data: {
                workOrderId: payload.workOrderId,
                facturaUrl: payload.facturaPdfUrl,
                estadoPago: payload.estadoPago,
                invoicedBy: payload.invoicedBy,
              },
              accion: {
                label: 'Ver factura',
                ruta: `/dashboard/work-orders/${payload.workOrderId}?tab=invoice`,
              },
            }),
          ),
        );
      }

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...adminsAndSecretaries.map((u) => u.usuarioId),
          ...(payload.invoicedBy ? [payload.invoicedBy] : []),
        ]),
      ];

      // Enviar en tiempo real a TODOS
      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir actualización a TODOS
      this.realtime.emitInvoiceUpdate(payload.workOrderId, {
        facturaUrl: payload.facturaPdfUrl,
        estadoPago: payload.estadoPago,
      });

      this.logger.log(
        `✅ Notificaciones enviadas a ${adminsAndSecretaries.length} usuarios`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.invoiced: ${error.message}`);
    }
  }

  @OnEvent('work-order.cancelled')
  async handleWorkOrderCancelled(payload: WorkOrderCancelledEvent) {
    this.logger.log(`📢 work-order.cancelled: orden ${payload.workOrderId}`);

    try {
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        admins[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.workOrderId &&
          n.tipo === NotificationType.WORK_ORDER_CANCELLED,
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          admins.map((user) =>
            this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.WORK_ORDER_CANCELLED,
              titulo: '❌ Orden cancelada',
              mensaje: `La orden #${payload.workOrderId} ha sido cancelada`,
              mensajeCorto: `Orden #${payload.workOrderId} cancelada`,
              data: {
                workOrderId: payload.workOrderId,
                canceladoPor: payload.canceladoPor,
              },
              accion: {
                label: 'Ver orden',
                ruta: `/dashboard/work-orders/${payload.workOrderId}`,
              },
            }),
          ),
        );
      }

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...admins.map((u) => u.usuarioId),
          ...(payload.canceladoPor ? [payload.canceladoPor] : []),
        ]),
      ];

      // Enviar en tiempo real a TODOS
      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir actualización a TODOS
      this.realtime.emitWorkOrderStatusUpdate(
        { ordenId: payload.workOrderId, estado: 'CANCELLED' },
        'ACTIVE',
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.cancelled: ${error.message}`);
    }
  }

  @OnEvent('work-order.technicians-rated')
  async handleTechniciansRated(payload: WorkOrderTechniciansRatedEvent) {
    this.logger.log(
      `📢 work-order.technicians-rated: orden ${payload.ordenId}`,
    );

    try {
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        admins[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.ordenId &&
          n.tipo === NotificationType.WORK_ORDER_COMPLETED &&
          n.mensaje.includes('técnicos calificados'),
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          admins.map((user) =>
            this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.WORK_ORDER_COMPLETED,
              titulo: '⭐ Técnicos calificados',
              mensaje: `La orden #${payload.ordenId} ya tiene todos los técnicos calificados. Lista para facturar.`,
              mensajeCorto: `Orden #${payload.ordenId} lista para facturar`,
              data: { workOrderId: payload.ordenId },
              accion: {
                label: 'Gestionar factura',
                ruta: `/dashboard/work-orders/${payload.ordenId}?tab=billing`,
              },
            }),
          ),
        );
      }

      // Enviar en tiempo real a TODOS
      await Promise.all(
        admins.map(async (user) => {
          const unreadCount = await this.notificationsService.getUnreadCount(
            user.usuarioId,
          );
          this.realtime.emitUnreadCount(user.usuarioId, unreadCount);
        }),
      );

      // Emitir evento específico
      this.realtime.emitTechniciansRated(payload.ordenId);
    } catch (error) {
      this.logger.error(
        `❌ Error en work-order.technicians-rated: ${error.message}`,
      );
    }
  }

  @OnEvent('work-order.emergency-created')
  async handleEmergencyCreated(payload: WorkOrderEmergencyCreatedEvent) {
    this.logger.log(
      `📢 work-order.emergency-created: orden emergencia ${payload.emergencyOrderId}`,
    );
    this.logger.log(
      `👤 Creado por usuario: ${payload.createdBy || 'desconocido'}`,
    );

    try {
      const queryBuilder = this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol = :rol', { rol: 'Administrador' })
        .andWhere('user.activo = true');

      const admins = await queryBuilder.getMany();

      if (admins.length === 0) return;

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        admins[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.WORK_ORDERS,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.workOrderId === payload.emergencyOrderId &&
          n.tipo === NotificationType.WORK_ORDER_CREATED,
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          admins.map((user) =>
            this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.WORK_ORDER_CREATED,
              titulo: '🚨 ORDEN DE EMERGENCIA CREADA',
              mensaje: `Se ha creado una orden de emergencia #${payload.emergencyOrderId} desde la orden #${payload.originalOrderId}`,
              mensajeCorto: `Emergencia #${payload.emergencyOrderId}`,
              data: {
                workOrderId: payload.emergencyOrderId,
                originalOrderId: payload.originalOrderId,
                createdBy: payload.createdBy,
              },
              accion: {
                label: 'Ver emergencia',
                ruta: `/dashboard/work-orders/${payload.emergencyOrderId}`,
              },
            }),
          ),
        );
      }

      // 🔥 CORREGIDO: Manejar undefined correctamente
      const allRecipients = [
        ...new Set([
          ...admins.map((u) => u.usuarioId),
          ...(payload.createdBy ? [payload.createdBy] : []),
        ]),
      ];

      // Enviar en tiempo real a TODOS
      await Promise.all(
        allRecipients.map(async (userId) => {
          const unreadCount =
            await this.notificationsService.getUnreadCount(userId);
          this.realtime.emitToUser(userId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir evento específico
      this.realtime.emitEmergencyCreated(payload.originalOrderId, {
        ordenId: payload.emergencyOrderId,
      });
    } catch (error) {
      this.logger.error(
        `❌ Error en work-order.emergency-created: ${error.message}`,
      );
    }
  }

  @OnEvent('stock.below-min')
  async handleStockBelowMin(payload: StockBelowMinEvent) {
    this.logger.log(`📢 stock.below-min: insumo ${payload.insumoId}`);

    try {
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol = :rol', { rol: 'Administrador' })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      // Verificar si ya existen notificaciones
      const existingNotifications = await this.notificationsService.findForUser(
        admins[0].usuarioId,
        {
          onlyUnread: true,
          modulo: NotificationModule.INVENTORY,
          limit: 50,
        },
      );

      const alreadyNotified = existingNotifications.some(
        (n) =>
          n.data?.insumoId === payload.insumoId &&
          n.tipo === NotificationType.STOCK_BELOW_MIN,
      );

      if (!alreadyNotified) {
        const notifications = await Promise.all(
          admins.map((user) =>
            this.notificationsService.create({
              usuarioId: user.usuarioId,
              tipo: NotificationType.STOCK_BELOW_MIN,
              titulo: '⚠️ Stock por debajo del mínimo',
              mensaje: `El insumo "${payload.nombre}" tiene stock de ${payload.cantidadActual} (mínimo: ${payload.stockMin})`,
              mensajeCorto: `Stock bajo: ${payload.nombre}`,
              data: {
                insumoId: payload.insumoId,
                cantidadActual: payload.cantidadActual,
                stockMin: payload.stockMin,
              },
              accion: {
                label: 'Ver insumo',
                ruta: `/inventory/${payload.insumoId}`,
              },
            }),
          ),
        );
      }

      // Enviar en tiempo real a TODOS
      await Promise.all(
        admins.map(async (user) => {
          const unreadCount = await this.notificationsService.getUnreadCount(
            user.usuarioId,
          );
          this.realtime.emitToUser(user.usuarioId, 'unread-count', {
            total: unreadCount,
          });
        }),
      );

      // Emitir actualización de inventario
      this.realtime.emitEntityUpdate('inventory', 'updated', {
        insumoId: payload.insumoId,
        stockActual: payload.cantidadActual,
      });
    } catch (error) {
      this.logger.error(`❌ Error en stock.below-min: ${error.message}`);
    }
  }
}
