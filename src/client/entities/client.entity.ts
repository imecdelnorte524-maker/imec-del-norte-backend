import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Area } from '../../area/entities/area.entity';
import { User } from '../../users/entities/user.entity';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { AtsReport } from '../../sg-sst/entities/ats-report.entity';
import { Image } from '../../images/entities/image.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

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

  @Column({ name: 'direccion_completa', length: 500, nullable: true })
  @IsOptional()
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

  @Column({ name: 'localizacion', length: 500 })
  @IsNotEmpty()
  localizacion: string;

  @Column({
    name: 'fecha_creacion_empresa',
    type: 'date',
    default: () => 'CURRENT_DATE',
  })
  @IsNotEmpty()
  fechaCreacionEmpresa: Date;

  // RELACIÓN CON MÚLTIPLES USUARIOS CONTACTO
  @ManyToMany(() => User, { eager: true })
  @JoinTable({
    name: 'clientes_usuarios_contacto',
    joinColumn: {
      name: 'id_cliente',
      referencedColumnName: 'idCliente',
    },
    inverseJoinColumn: {
      name: 'id_usuario',
      referencedColumnName: 'usuarioId',
    },
  })
  usuariosContacto: User[];

  @OneToMany(() => Area, (area) => area.cliente)
  areas: Area[];

  @OneToMany(() => AtsReport, (atsReport) => atsReport.client)
  atsReports: AtsReport[];

  @OneToMany(() => Image, (image) => image.client)
  images: Image[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt: Date;

  @OneToMany(() => Warehouse, (warehouse) => warehouse.cliente)
  bodegas: Warehouse[];
}