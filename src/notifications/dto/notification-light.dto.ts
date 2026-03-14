// src/notifications/dto/notification-light.dto.ts
export class NotificationLightDto {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: Date;
  data: {
    workOrderId?: number;
    insumoId?: number;
    [key: string]: any;
  };

  static fromEntity(notif: any): NotificationLightDto {
    return {
      id: notif.notificacionId,
      tipo: notif.tipo,
      titulo: notif.titulo,
      mensaje: notif.mensajeCorto || notif.mensaje.substring(0, 100),
      leida: notif.leida,
      fechaCreacion: notif.fechaCreacion,
      data: notif.data || {},
    };
  }
}
