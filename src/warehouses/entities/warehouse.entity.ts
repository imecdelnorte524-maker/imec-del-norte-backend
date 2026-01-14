// src/warehouses/entities/warehouse.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Client } from '../../client/entities/client.entity';

@Entity('bodegas')
export class Warehouse {
  @PrimaryGeneratedColumn({ name: 'bodega_id' })
  bodegaId: number;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ length: 200, nullable: true, name: 'direccion' })
  direccion: string;

  @Column({ default: true, name: 'activa' })
  activa: boolean;

  // NUEVO: Relación con cliente (opcional)
  @Column({ name: 'cliente_id', nullable: true, type: 'int' })
  clienteId: number | null; 

  @ManyToOne(() => Client, (cliente) => cliente.bodegas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date;

  @OneToMany(() => Inventory, (inventory) => inventory.bodega)
  inventarios: Inventory[];
}