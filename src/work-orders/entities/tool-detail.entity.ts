import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { Tool } from '../../tools/entities/tool.entity';

@Entity('detalles_herramienta_asignado')
export class ToolDetail {
  @PrimaryGeneratedColumn({ name: 'detalle_herramienta_id' })
  detalleHerramientaId: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'herramienta_id' })
  herramientaId: number;

  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => Tool)
  @JoinColumn({ name: 'herramienta_id' })
  tool: Tool;

  @Column({ name: 'tiempo_uso', length: 50, nullable: true })
  tiempoUso: string;

  @Column({ name: 'comentarios_uso', nullable: true })
  comentariosUso: string;
}