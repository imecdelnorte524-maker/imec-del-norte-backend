import {
  NotificationType,
  NotificationPriority,
  NotificationModule,
} from '../../shared/index';

export interface CreateNotificationDto {
  usuarioId: number;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  mensajeCorto?: string;
  data?: Record<string, any>;
  accion?: {
    label: string;
    ruta: string;
    params?: Record<string, any>;
  };
  prioridad?: NotificationPriority;
  modulo?: NotificationModule;
  visibleHasta?: Date;
}
