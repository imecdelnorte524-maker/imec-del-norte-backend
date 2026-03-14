// src/work-orders/dto/work-order-light.dto.ts
export class WorkOrderLightDto {
  ordenId: number;
  estado: string;
  titulo?: string;
  fechaCreacion: Date;
  clienteId: number;
  clienteNombre?: string;
  tecnicoIds: number[];
  tieneEquipos: boolean;
  isEmergency: boolean;

  static fromEntity(wo: any): WorkOrderLightDto {
    return {
      ordenId: wo.ordenId,
      estado: wo.estado,
      titulo: wo.titulo || `Orden #${wo.ordenId}`,
      fechaCreacion: wo.fechaCreacion,
      clienteId: wo.clienteId,
      clienteNombre: wo.cliente?.nombre,
      tecnicoIds: wo.technicians?.map((t) => t.tecnicoId) || [],
      tieneEquipos: (wo.equipmentWorkOrders?.length || 0) > 0,
      isEmergency: wo.isEmergency || false,
    };
  }

  // Versión ultra ligera para broadcasts masivos
  static forBroadcast(wo: any): any {
    return {
      ordenId: wo.ordenId,
      estado: wo.estado,
      fechaCreacion: wo.fechaCreacion,
      clienteId: wo.clienteId,
    };
  }
}
