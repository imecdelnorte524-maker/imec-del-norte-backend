// src/client/entities/client.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Area } from '../../area/entities/area.entity';
import { User } from '../../users/entities/user.entity';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { AtsReport } from 'src/sg-sst/entities/ats-report.entity';
import { Image } from '../../images/entities/image.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';

@Entity('clientes')
export class Client {
  @PrimaryGeneratedColumn({ name: 'id_cliente' })
  idCliente: number;

  @Column({ name: 'nombre', length: 255 })
  @IsNotEmpty()
  nombre: string;

  @Column({ name: 'nit', length: 20, unique: true })
  @IsNotEmpty()
  nit: string;

  // --- NUEVOS CAMPOS DE DIRECCIÓN DESGLOSADA ---
  @Column({ name: 'direccion_base', length: 255 })
  @IsNotEmpty({ message: 'La dirección base es requerida' })
  direccionBase: string;

  @Column({ name: 'barrio', length: 100 })
  @IsNotEmpty({ message: 'El barrio es requerido' })
  barrio: string;

  @Column({ name: 'ciudad', length: 100 })
  @IsNotEmpty({ message: 'La ciudad es requerida' })
  ciudad: string;

  @Column({ name: 'departamento', length: 100 })
  @IsNotEmpty({ message: 'El departamento es requerido' })
  departamento: string;

  @Column({ name: 'pais', length: 100, default: 'Colombia' })
  @IsNotEmpty({ message: 'El país es requerido' })
  pais: string;
  // --- FIN NUEVOS CAMPOS DE DIRECCIÓN DESGLOSADA ---

  // Campo de dirección completa (deshabilitado/autogenerado)
  @Column({ name: 'direccion_completa', length: 500, nullable: true })
  @IsOptional() // Marcar como opcional ya que se autogenera
  direccionCompleta: string;

  @Column({ name: 'contacto', length: 100 })
  @IsNotEmpty()
  contacto: string;

  @Column({ name: 'email', unique: true })
  @IsEmail()
  email: string;

  @Column({ name: 'telefono', length: 20 })
  @IsNotEmpty()
  telefono: string;

  // URL de Google Maps (se aumenta el length a 500)
  @Column({ name: 'localizacion', length: 500 })
  @IsNotEmpty()
  localizacion: string;

  // Fecha de creación de la empresa (no del registro en el sistema)
  @Column({
    name: 'fecha_creacion_empresa',
    type: 'date',
    default: () => 'CURRENT_DATE',
  })
  @IsNotEmpty()
  fechaCreacionEmpresa: Date;

  @Column({ name: 'id_usuario_contacto' })
  idUsuarioContacto: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'id_usuario_contacto' })
  usuarioContacto: User;

  @OneToMany(() => Area, (area) => area.cliente)
  areas: Area[];

  @OneToMany(() => AtsReport, (atsReport) => atsReport.client)
  atsReports: AtsReport[];

  @OneToMany(() => Image, (image) => image.client)
  images: Image[];

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => Warehouse, (warehouse) => warehouse.cliente)
  bodegas: Warehouse[];
}