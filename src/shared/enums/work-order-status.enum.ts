// src/work-orders/enums/work-order-status.enum.ts
export enum WorkOrderStatus {
  REQUESTED_UNASSIGNED = 'Solicitada sin asignar',
  REQUESTED_ASSIGNED = 'Solicitada asignada',
  IN_PROGRESS = 'En proceso',
  PAUSED = 'En pausa',
  COMPLETED = 'Finalizada',
  CANCELED = 'Cancelada',
}