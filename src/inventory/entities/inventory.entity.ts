// src/inventory/entities/inventory.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Tool } from '../../tools/entities/tool.entity';
import { Supply } from '../../supplies/entities/supply.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('inventario')
@Index('UQ_INVENTARIO_INSUMO_BODEGA', ['insumoId', 'bodega'], {
  unique: true,
  where: 'insumo_id IS NOT NULL AND bodega_id IS NOT NULL',
})
@Index('UQ_INVENTARIO_HERRAMIENTA', ['herramientaId'], {
  unique: true,
  where: 'herramienta_id IS NOT NULL',
})
export class Inventory {
  @PrimaryGeneratedColumn({ name: 'inventario_id' })
  inventarioId: number;

  @Column({ name: 'insumo_id', nullable: true })
  insumoId: number | null;

  @Column({ name: 'herramienta_id', nullable: true })
  herramientaId: number | null;

  // MUCHOS inventarios pueden apuntar al mismo insumo
  @ManyToOne(() => Supply, (supply) => supply.inventories, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'insumo_id' })
  supply: Supply | null;

  // UNA sola fila de inventario por herramienta
  @OneToOne(() => Tool, (tool) => tool.inventory, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'herramienta_id' })
  tool: Tool | null;

  @Column({
    name: 'cantidad_actual',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  cantidadActual: number;

  @Column({ name: 'ubicacion', type: 'varchar', length: 200, nullable: true })
  ubicacion: string | null;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.inventarios, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'bodega_id' })
  bodega: Warehouse | null;

  @UpdateDateColumn({ name: 'fecha_ultima_actualizacion' })
  fechaUltimaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date | null;

  // Helpers
  get tipo(): string {
    return this.insumoId ? 'insumo' : 'herramienta';
  }

  get nombreItem(): string {
    if (this.supply) return this.supply.nombre;
    if (this.tool) return this.tool.nombre;
    return '';
  }

  get unidadMedida(): string {
    if (this.supply?.unidadMedida) return this.supply.unidadMedida.nombre;
    if (this.tool) return 'Unidad';
    return '';
  }

  get valorUnitario(): number {
    if (this.supply) return this.supply.valorUnitario;
    if (this.tool) return this.tool.valorUnitario;
    return 0;
  }

  // Estado calculado del inventario (para vistas / dashboards)
  get estadoInventario(): string {
    if (this.insumoId && this.supply) {
      const cantidad = Number(this.cantidadActual || 0);
      const stockMin = this.supply.stockMin || 0;

      if (cantidad <= 0) return 'Sin Stock';
      if (stockMin > 0 && cantidad <= stockMin) return 'Stock Bajo';
      if (cantidad <= 5) return 'Stock Crítico';
      if (cantidad <= 10) return 'Stock Bajo';
      return 'Stock Óptimo';
    }

    if (this.herramientaId && this.tool) {
      // Reutilizamos el estado de la herramienta
      return this.tool.estado;
    }

    return '';
  }
}
