// src/notifications/listeners/work-orders-notifications.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../client/entities/client.entity';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../../shared/index';

// Interfaces basadas en los eventos que emites
interface WorkOrderCreatedEvent {
  workOrderId: number;
  clienteId: number;
  servicioId: number;
  equipmentIds: number[];
  isEmergency: boolean;
}

interface WorkOrderAssignedEvent {
  workOrderId: number;
  technicianIds: number[];
  leaderTechnicianId?: number;
  clienteId: number;
  servicioId: number;
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
  clienteId: number; // 👈 Agregado
  clienteEmpresaId?: number;
}

interface WorkOrderInvoicedEvent {
  workOrderId: number;
  facturaPdfUrl: string;
  estadoPago: string;
  fechaFacturacion: Date;
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
}

@Injectable()
export class WorkOrdersNotificationsListener {
  private readonly logger = new Logger(WorkOrdersNotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
  ) {}

  /**
   * 1. ORDEN CREADA → Administradores y Secretarias
   */
  @OnEvent('work-order.created')
  async handleWorkOrderCreated(payload: WorkOrderCreatedEvent) {
    this.logger.log(`📢 work-order.created: orden ${payload.workOrderId}`);

    try {
      // Buscar Administradores y Secretarias activos
      const adminsAndSecretaries = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (adminsAndSecretaries.length === 0) {
        this.logger.warn('⚠️ No hay Administradores o Secretarias activos');
        return;
      }

      // Opcional: Obtener nombre del cliente para personalizar mensaje
      let clienteNombre = '';
      const cliente = await this.usersRepo.findOne({
        where: { usuarioId: payload.clienteId },
      });
      if (cliente) {
        clienteNombre =
          `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
      }

      const notificaciones = adminsAndSecretaries.map((user) =>
        this.notificationsService.createAndSend({
          usuarioId: user.usuarioId,
          tipo: NotificationType.WORK_ORDER_CREATED,
          titulo: payload.isEmergency
            ? '🚨 ORDEN DE EMERGENCIA'
            : 'Nueva orden de trabajo',
          mensaje: payload.isEmergency
            ? `Se ha creado una orden de EMERGENCIA #${payload.workOrderId}`
            : `Se ha creado una nueva orden #${payload.workOrderId}${clienteNombre ? ` para ${clienteNombre}` : ''}`,
          mensajeCorto: `Orden #${payload.workOrderId} ${payload.isEmergency ? '🚨' : 'creada'}`,
          data: {
            workOrderId: payload.workOrderId,
            clienteId: payload.clienteId,
            servicioId: payload.servicioId,
            equipmentIds: payload.equipmentIds,
            isEmergency: payload.isEmergency,
          },
          accion: {
            label: 'Ver orden',
            ruta: `/dashboard/work-orders/${payload.workOrderId}`,
          },
        }),
      );

      await Promise.all(notificaciones);
      this.logger.log(
        `✅ Notificaciones enviadas a ${adminsAndSecretaries.length} usuarios`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.created: ${error.message}`);
    }
  }

  /**
   * 2. ORDEN ASIGNADA → Solo al técnico asignado
   */
  @OnEvent('work-order.assigned')
  async handleWorkOrderAssigned(payload: WorkOrderAssignedEvent) {
    this.logger.log('='.repeat(60));
    this.logger.log(`📢 work-order.assigned: orden ${payload.workOrderId}`);

    if (!payload.technicianIds || payload.technicianIds.length === 0) {
      this.logger.warn('⚠️ Evento assigned sin technicianIds');
      return;
    }

    const technicians = await this.usersRepo.find({
      where: {
        usuarioId: In(payload.technicianIds),
        activo: true,
      },
      relations: ['role'],
    });

    // 🔥 FILTRO CORREGIDO - acepta con o sin acento
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
    const notificaciones = validTechnicians.map((tech) => {
      const esLider = tech.usuarioId === leaderId;
      return this.notificationsService.createAndSend({
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
        },
        accion: {
          label: 'Ver mi orden',
          ruta: `/dashboard/technician/work-orders/${payload.workOrderId}`,
        },
      });
    });

    await Promise.all(notificaciones);
    this.logger.log(
      `✅ Notificaciones enviadas a ${validTechnicians.length} técnicos`,
    );
    this.logger.log('='.repeat(60));
  }

  /**
   * 3. ORDEN EN PROCESO → Solo al cliente
   */
  @OnEvent('work-order.started')
  async handleWorkOrderStarted(payload: WorkOrderStartedEvent) {
    this.logger.log(`📢 work-order.started: orden ${payload.workOrderId}`);

    try {
      // Buscar el usuario cliente
      const cliente = await this.usersRepo.findOne({
        where: { usuarioId: payload.clienteId, activo: true },
      });

      if (!cliente) {
        this.logger.warn(`⚠️ Cliente ${payload.clienteId} no encontrado`);
        return;
      }

      await this.notificationsService.createAndSend({
        usuarioId: cliente.usuarioId,
        tipo: NotificationType.WORK_ORDER_IN_PROGRESS,
        titulo: '🔄 Orden de trabajo en proceso',
        mensaje: `La orden #${payload.workOrderId} ha comenzado a ejecutarse`,
        mensajeCorto: `Orden #${payload.workOrderId} en proceso`,
        data: {
          workOrderId: payload.workOrderId,
          fechaInicio: payload.fechaInicio,
        },
        accion: {
          label: 'Seguir orden',
          ruta: `/dashboard/client/work-orders/${payload.workOrderId}`,
        },
      });

      this.logger.log(
        `✅ Notificación enviada al cliente ${cliente.nombre || ''}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.started: ${error.message}`);
    }
  }

  /**
   * 4. ORDEN FINALIZADA → Cliente, Secretaria y Admin
   */
  @OnEvent('work-order.completed')
  async handleWorkOrderCompleted(payload: WorkOrderCompletedEvent) {
    this.logger.log(`📢 work-order.completed: orden ${payload.workOrderId}`);

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

      // Preparar destinatarios: admins + secretarias + cliente (si existe)
      const destinatarios = [...adminsAndSecretaries];

      if (cliente) {
        // Evitar duplicados si el cliente también es admin (poco probable pero por si acaso)
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

      const notificaciones = destinatarios.map((user) => {
        // Determinar si es el cliente para personalizar el mensaje
        const esCliente = user.usuarioId === payload.clienteId;

        return this.notificationsService.createAndSend({
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
          },
          accion: {
            label: 'Ver orden',
            ruta: esCliente
              ? `/dashboard/client/work-orders/${payload.workOrderId}`
              : `/dashboard/work-orders/${payload.workOrderId}`,
          },
        });
      });

      await Promise.all(notificaciones);
      this.logger.log(
        `✅ Notificaciones enviadas a ${destinatarios.length} usuarios`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en work-order.completed: ${error.message}`);
    }
  }

  /**
   * 5. ORDEN FACTURADA → Administradores y Secretarias
   */
  @OnEvent('work-order.invoiced')
  async handleWorkOrderInvoiced(payload: WorkOrderInvoicedEvent) {
    this.logger.log(`📢 work-order.invoiced: orden ${payload.workOrderId}`);

    try {
      const adminsAndSecretaries = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (adminsAndSecretaries.length === 0) return;

      const estadoPagoTexto =
        payload.estadoPago === 'Pagado' ? '💰 Pagada' : '⏳ Pendiente de pago';

      const notificaciones = adminsAndSecretaries.map((user) =>
        this.notificationsService.createAndSend({
          usuarioId: user.usuarioId,
          tipo: NotificationType.WORK_ORDER_INVOICED,
          titulo: '💰 Orden facturada',
          mensaje: `La orden #${payload.workOrderId} ha sido facturada. ${estadoPagoTexto}`,
          mensajeCorto: `Orden #${payload.workOrderId} facturada`,
          data: {
            workOrderId: payload.workOrderId,
            facturaUrl: payload.facturaPdfUrl,
            estadoPago: payload.estadoPago,
          },
          accion: {
            label: 'Ver factura',
            ruta: `/dashboard/work-orders/${payload.workOrderId}?tab=invoice`,
          },
        }),
      );

      await Promise.all(notificaciones);
    } catch (error) {
      this.logger.error(`❌ Error en work-order.invoiced: ${error.message}`);
    }
  }

  /**
   * ORDEN CANCELADA → Administradores y Secretarias
   */
  @OnEvent('work-order.cancelled')
  async handleWorkOrderCancelled(payload: WorkOrderCancelledEvent) {
    this.logger.log(`📢 work-order.cancelled: orden ${payload.workOrderId}`);

    try {
      // Notificar a Admin/Secretarias
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      await Promise.all(
        admins.map((user) =>
          this.notificationsService.createAndSend({
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
    } catch (error) {
      this.logger.error(`❌ Error en work-order.cancelled: ${error.message}`);
    }
  }

  /**
   * TÉCNICOS CALIFICADOS → Notificar que ya se puede facturar
   */
  @OnEvent('work-order.technicians-rated')
  async handleTechniciansRated(payload: WorkOrderTechniciansRatedEvent) {
    this.logger.log(
      `📢 work-order.technicians-rated: orden ${payload.ordenId}`,
    );

    try {
      // Notificar a Admin/Secretarias que ya pueden facturar
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      await Promise.all(
        admins.map((user) =>
          this.notificationsService.createAndSend({
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
    } catch (error) {
      this.logger.error(
        `❌ Error en work-order.technicians-rated: ${error.message}`,
      );
    }
  }

  /**
   * ORDEN DE EMERGENCIA CREADA → Notificar a Administradores
   */
  @OnEvent('work-order.emergency-created')
  async handleEmergencyCreated(payload: WorkOrderEmergencyCreatedEvent) {
    this.logger.log(
      `📢 work-order.emergency-created: orden emergencia ${payload.emergencyOrderId}`,
    );

    try {
      // Notificar a todos los admin de la emergencia
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol = :rol', { rol: 'Administrador' })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      await Promise.all(
        admins.map((user) =>
          this.notificationsService.createAndSend({
            usuarioId: user.usuarioId,
            tipo: NotificationType.WORK_ORDER_CREATED,
            titulo: '🚨 ORDEN DE EMERGENCIA CREADA',
            mensaje: `Se ha creado una orden de emergencia #${payload.emergencyOrderId} desde la orden #${payload.originalOrderId}`,
            mensajeCorto: `Emergencia #${payload.emergencyOrderId}`,
            data: {
              workOrderId: payload.emergencyOrderId,
              originalOrderId: payload.originalOrderId,
            },
            accion: {
              label: 'Ver emergencia',
              ruta: `/dashboard/work-orders/${payload.emergencyOrderId}`,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `❌ Error en work-order.emergency-created: ${error.message}`,
      );
    }
  }
}
