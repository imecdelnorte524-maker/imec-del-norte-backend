// src/client/entities/client.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Area } from '../../area/entities/area.entity';
import { User } from '../../users/entities/user.entity';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { AtsReport } from 'src/sg-sst/entities/ats-report.entity';

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

  @Column({ name: 'direccion', length: 500 })
  @IsNotEmpty()
  direccion: string;

  @Column({ name: 'contacto', length: 100 })
  @IsNotEmpty()
  contacto: string;

  @Column({ name: 'email', unique: true })
  @IsEmail()
  email: string;

  @Column({ name: 'telefono', length: 20 })
  @IsNotEmpty()
  telefono: string;

  @Column({ name: 'localizacion', length: 255 })
  @IsNotEmpty()
  localizacion: string;

  @Column({ name: 'id_usuario_contacto' })
  idUsuarioContacto: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'id_usuario_contacto' })
  usuarioContacto: User;

  @OneToMany(() => Area, (area) => area.cliente)
  areas: Area[];

  @OneToMany(() => AtsReport, (atsReport) => atsReport.client)
  atsReports: AtsReport[];

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}