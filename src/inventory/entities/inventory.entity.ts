// src/inventory/entities/inventory.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tool } from '../../tools/entities/tool.entity';
import { Supply } from '../../supplies/entities/supply.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('inventario')
@Index('IDX_INVENTARIO_BODEGA_EQUIPO', ['bodega', 'herramientaId'], {
  unique: true,
  where: 'herramienta_id IS NOT NULL AND bodega_id IS NOT NULL',
})
@Index('IDX_INVENTARIO_BODEGA_INSUMO', ['bodega', 'insumoId'], {
  unique: true,
  where: 'insumo_id IS NOT NULL AND bodega_id IS NOT NULL',
})
export class Inventory {
  @PrimaryGeneratedColumn({ name: 'inventario_id' })
  inventarioId: number;

  @Column({ name: 'insumo_id', nullable: true })
  insumoId: number;

  @Column({ name: 'herramienta_id', nullable: true })
  herramientaId: number;

  // RELACIÓN UNO A UNO CON INSUMO (ELIMINACIÓN EN CASCADA)
  @OneToOne(() => Supply, (supply) => supply.inventory, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'insumo_id' })
  supply: Supply;

  // RELACIÓN UNO A UNO CON HERRAMIENTA (ELIMINACIÓN EN CASCADA)
  @OneToOne(() => Tool, (tool) => tool.inventory, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'herramienta_id' })
  tool: Tool;

  @Column({
    name: 'cantidad_actual',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  cantidadActual: number;

  @Column({ name: 'ubicacion', type: 'varchar', length: 200, nullable: true })
  ubicacion: string;

  // RELACIÓN CON BODEGA (nullable)
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.inventarios, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'bodega_id' })
  bodega: Warehouse | null;

  @UpdateDateColumn({ name: 'fecha_ultima_actualizacion' })
  fechaUltimaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date;

  // Helper methods
  get tipo(): string {
    return this.insumoId ? 'insumo' : 'herramienta';
  }

  get nombreItem(): string {
    if (this.supply) return this.supply.nombre;
    if (this.tool) return this.tool.nombre;
    return '';
  }

  get unidadMedida(): string {
    if (this.supply && this.supply.unidadMedida) return this.supply.unidadMedida.nombre;
    if (this.tool) return 'Unidad';
    return '';
  }

  get valorUnitario(): number {
    if (this.supply) return this.supply.valorUnitario;
    if (this.tool) return this.tool.valorUnitario;
    return 0;
  }

  // Método para calcular estado basado en cantidad
  calcularEstado(): string {
    if (this.cantidadActual <= 0) return 'Sin Stock';
    if (this.cantidadActual <= 5) return 'Stock Crítico';
    if (this.cantidadActual <= 10) return 'Stock Bajo';
    return 'Stock Óptimo';
  }
}