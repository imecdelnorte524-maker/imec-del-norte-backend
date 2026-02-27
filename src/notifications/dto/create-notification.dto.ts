// notifications/dto/create-notification.dto.ts
import { NotificationType, NotificationPriority, NotificationModule } from '../../shared/index';

export interface CreateNotificationDto {
  usuarioId: number;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  mensajeCorto?: string; // Versión corta para dropdown
  data?: Record<string, any>;
  accion?: {
    label: string;
    ruta: string;
    params?: Record<string, any>;
  };
  prioridad?: NotificationPriority; // Si no se envía, se asigna según el tipo
  modulo?: NotificationModule; // Si no se envía, se asigna según el tipo
  visibleHasta?: Date; // Fecha de expiración opcional
}