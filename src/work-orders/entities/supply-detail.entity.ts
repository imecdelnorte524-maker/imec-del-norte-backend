import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { Supply } from '../../supplies/entities/supply.entity';

@Entity('detalles_insumo_usado')
export class SupplyDetail {
  @PrimaryGeneratedColumn({ name: 'detalle_insumo_id' })
  detalleInsumoId: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'insumo_id' })
  insumoId: number;

  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => Supply)
  @JoinColumn({ name: 'insumo_id' })
  supply: Supply;

  @Column({ name: 'cantidad_usada', type: 'decimal', precision: 10, scale: 2 })
  cantidadUsada: number;

  @Column({ name: 'costo_unitario_al_momento', type: 'decimal', precision: 10, scale: 2, nullable: true })
  costoUnitarioAlMomento: number;
}