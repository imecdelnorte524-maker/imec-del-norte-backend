import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, CreateDateColumn, Index, OneToOne } from 'typeorm';
import { Tool } from '../../tools/entities/tool.entity';
import { Supply } from '../../supplies/entities/supply.entity';

@Entity('inventario')
@Index('IDX_INVENTARIO_UBICACION_EQUIPO', ['ubicacion', 'herramientaId'], { unique: true, where: 'herramienta_id IS NOT NULL AND ubicacion IS NOT NULL' })
@Index('IDX_INVENTARIO_UBICACION_INSUMO', ['ubicacion', 'insumoId'], { unique: true, where: 'insumo_id IS NOT NULL AND ubicacion IS NOT NULL' })
export class Inventory {
  @PrimaryGeneratedColumn({ name: 'inventario_id' })
  inventarioId: number;

  @Column({ name: 'insumo_id', nullable: true })
  insumoId: number;

  @Column({ name: 'herramienta_id', nullable: true })
  herramientaId: number;

  // RELACIÓN UNO A UNO CON INSUMO (ELIMINACIÓN EN CASCADA)
  @OneToOne(() => Supply, supply => supply.inventory, {
    nullable: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'insumo_id' })
  supply: Supply;

  // RELACIÓN UNO A UNO CON EQUIPO (ELIMINACIÓN EN CASCADA)
  @OneToOne(() => Tool, tool => tool.inventory, {
    nullable: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'herramienta_id' })
  tool: Tool;

  @Column({ name: 'cantidad_actual', type: 'decimal', precision: 10, scale: 2, default: 0 })
  cantidadActual: number;

  @Column({ length: 100, nullable: true })
  ubicacion: string;

  @CreateDateColumn({ name: 'fecha_ultima_actualizacion' })
  fechaUltimaActualizacion: Date;

  // Helper methods
  get tipo(): string {
    return this.insumoId ? 'insumo' : 'Herramienta';
  }

  get nombreItem(): string {
    if (this.supply) return this.supply.nombre;
    if (this.tool) return this.tool.nombre;
    return '';
  }
}