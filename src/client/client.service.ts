import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Client } from './entities/client.entity';
import { User } from '../users/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly realtime: RealtimeService,
  ) {}

  private getRoleName(currentUser: any): string {
    return currentUser?.role?.nombreRol || currentUser?.role || '';
  }

  private _generateFullAddress(clientData: Partial<Client>): string {
    const parts = [
      clientData.direccionBase,
      clientData.barrio,
      clientData.ciudad,
      clientData.departamento,
      clientData.pais,
    ].filter(Boolean);
    return parts.join(', ');
  }

  private validateJuridicaFields(createClientDto: CreateClientDto): void {
    if (!createClientDto.nit) {
      throw new BadRequestException(
        'El NIT es requerido para persona jurídica',
      );
    }
    if (!createClientDto.fechaCreacionEmpresa) {
      throw new BadRequestException(
        'La fecha de creación es requerida para persona jurídica',
      );
    }
    if (!createClientDto.barrio) {
      throw new BadRequestException(
        'El barrio es requerido para persona jurídica',
      );
    }
    if (!createClientDto.departamento) {
      throw new BadRequestException(
        'El departamento es requerido para persona jurídica',
      );
    }
    if (!createClientDto.pais) {
      throw new BadRequestException(
        'El país es requerido para persona jurídica',
      );
    }
  }

  async create(
    createClientDto: CreateClientDto,
    currentUser: any,
  ): Promise<Client> {
    const roleName = this.getRoleName(currentUser);
    const tipoCliente = createClientDto.tipoCliente || 'juridica';

    // Validar según tipo de cliente
    if (tipoCliente === 'juridica') {
      this.validateJuridicaFields(createClientDto);

      // Validar NIT único solo para jurídica
      if (createClientDto.nit) {
        const existingClient = await this.clientRepository.findOne({
          where: { nit: createClientDto.nit },
        });
        if (existingClient) {
          throw new ConflictException('Ya existe un cliente con este NIT');
        }
      }
    }

    // Validar email único solo si se proporciona
    if (createClientDto.email) {
      const existingClientByEmail = await this.clientRepository.findOne({
        where: { email: createClientDto.email },
      });
      if (existingClientByEmail) {
        throw new ConflictException('Ya existe un cliente con este email');
      }
    }

    let usuariosContacto: User[] = [];

    if (roleName === 'Cliente') {
      // Para usuarios Cliente, se agrega automáticamente como contacto
      const user = await this.userRepository.findOne({
        where: { usuarioId: currentUser.userId },
      });

      if (!user) {
        throw new NotFoundException(
          `Usuario autenticado con ID ${currentUser.userId} no encontrado`,
        );
      }

      usuariosContacto = [user];

      // Opcionalmente forzamos algunos campos si vienen vacíos
      if (!createClientDto.contacto) {
        createClientDto.contacto =
          `${user.nombre} ${user.apellido || ''}`.trim();
      }
      if (!createClientDto.email) {
        createClientDto.email = user.email;
      }
      if (!createClientDto.telefono && user.telefono) {
        createClientDto.telefono = user.telefono;
      }
    } else {
      // Para Administrador/Secretaria, usar los IDs proporcionados
      if (
        createClientDto.usuariosContactoIds &&
        createClientDto.usuariosContactoIds.length > 0
      ) {
        usuariosContacto = await this.userRepository.find({
          where: { usuarioId: In(createClientDto.usuariosContactoIds) },
        });

        if (
          usuariosContacto.length !== createClientDto.usuariosContactoIds.length
        ) {
          const foundIds = usuariosContacto.map((u) => u.usuarioId);
          const missingIds = createClientDto.usuariosContactoIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new NotFoundException(
            `Los siguientes usuarios contacto no existen: ${missingIds.join(', ')}`,
          );
        }
      } else {
        throw new BadRequestException(
          'Debe proporcionar al menos un usuario contacto',
        );
      }
    }

    // Convertir fecha a Date o null
    let fechaCreacionEmpresa: Date | null = null;
    if (
      createClientDto.fechaCreacionEmpresa &&
      createClientDto.fechaCreacionEmpresa !== ''
    ) {
      fechaCreacionEmpresa = new Date(createClientDto.fechaCreacionEmpresa);
    }

    // Crear la instancia del cliente con los tipos correctos
    const clientData: Partial<Client> = {
      tipoCliente,
      nombre: createClientDto.nombre,
      nit: createClientDto.nit || undefined,
      verification_digit: createClientDto.verification_digit,
      direccionBase: createClientDto.direccionBase,
      barrio: createClientDto.barrio || undefined,
      ciudad: createClientDto.ciudad,
      departamento: createClientDto.departamento || undefined,
      pais: createClientDto.pais || 'Colombia',
      contacto: createClientDto.contacto,
      email: createClientDto.email || undefined,
      telefono: createClientDto.telefono,
      localizacion: createClientDto.localizacion,
      fechaCreacionEmpresa: fechaCreacionEmpresa || undefined,
      usuariosContacto,
    };

    const client = this.clientRepository.create(clientData);

    // Autogenerar dirección completa
    client.direccionCompleta = this._generateFullAddress(client);

    const savedClient = await this.clientRepository.save(client);

    // Evento WebSocket: cliente creado
    this.realtime.emitEntityUpdate('clients', 'created', savedClient);

    return savedClient;
  }

  async findAll(): Promise<Client[]> {
    return await this.clientRepository.find({
      relations: ['usuariosContacto', 'areas', 'areas.subAreas', 'images'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: id },
      relations: [
        'usuariosContacto',
        'areas',
        'areas.subAreas',
        'images',
        'bodegas',
      ],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  async findByNit(nit: string): Promise<Client | null> {
    return await this.clientRepository.findOne({
      where: { nit },
      relations: [
        'usuariosContacto',
        'areas',
        'areas.subAreas',
        'images',
        'bodegas',
      ],
    });
  }

  async update(id: number, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    const tipoCliente = updateClientDto.tipoCliente || client.tipoCliente;

    // Validar según tipo de cliente
    if (tipoCliente === 'juridica') {
      // Para jurídica, validar campos requeridos si se están actualizando
      if (updateClientDto.nit === '') {
        throw new BadRequestException(
          'El NIT no puede estar vacío para persona jurídica',
        );
      }

      // Validar NIT único si se está actualizando
      if (updateClientDto.nit && updateClientDto.nit !== client.nit) {
        const existingClient = await this.findByNit(updateClientDto.nit);
        if (existingClient) {
          throw new ConflictException('Ya existe otro cliente con este NIT');
        }
      }
    }

    // Validar email único si se actualiza
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingClient = await this.clientRepository.findOne({
        where: { email: updateClientDto.email },
      });
      if (existingClient) {
        throw new ConflictException('Ya existe otro cliente con este email');
      }
    }

    // Actualizar usuarios contacto si vienen IDs nuevos
    if (updateClientDto.usuariosContactoIds !== undefined) {
      if (updateClientDto.usuariosContactoIds.length === 0) {
        throw new BadRequestException(
          'Debe haber al menos un usuario contacto',
        );
      }

      const usuariosContacto = await this.userRepository.find({
        where: { usuarioId: In(updateClientDto.usuariosContactoIds) },
      });

      if (
        usuariosContacto.length !== updateClientDto.usuariosContactoIds.length
      ) {
        const foundIds = usuariosContacto.map((u) => u.usuarioId);
        const missingIds = updateClientDto.usuariosContactoIds.filter(
          (id) => !foundIds.includes(id),
        );
        throw new NotFoundException(
          `Los siguientes usuarios contacto no existen: ${missingIds.join(', ')}`,
        );
      }

      client.usuariosContacto = usuariosContacto;
    }

    // Actualizar campos uno por uno para evitar problemas de tipos
    if (updateClientDto.tipoCliente !== undefined)
      client.tipoCliente = updateClientDto.tipoCliente;
    if (updateClientDto.nombre !== undefined)
      client.nombre = updateClientDto.nombre;
    if (updateClientDto.nit !== undefined)
      client.nit = updateClientDto.nit || undefined;
    if (updateClientDto.verification_digit !== undefined)
      client.verification_digit = updateClientDto.verification_digit;
    if (updateClientDto.direccionBase !== undefined)
      client.direccionBase = updateClientDto.direccionBase;
    if (updateClientDto.barrio !== undefined)
      client.barrio = updateClientDto.barrio || undefined;
    if (updateClientDto.ciudad !== undefined)
      client.ciudad = updateClientDto.ciudad;
    if (updateClientDto.departamento !== undefined)
      client.departamento = updateClientDto.departamento || undefined;
    if (updateClientDto.pais !== undefined)
      client.pais = updateClientDto.pais || 'Colombia';
    if (updateClientDto.contacto !== undefined)
      client.contacto = updateClientDto.contacto;
    if (updateClientDto.email !== undefined)
      client.email = updateClientDto.email || undefined;
    if (updateClientDto.telefono !== undefined)
      client.telefono = updateClientDto.telefono;
    if (updateClientDto.localizacion !== undefined)
      client.localizacion = updateClientDto.localizacion;

    // Manejar fecha correctamente
    if (updateClientDto.fechaCreacionEmpresa !== undefined) {
      if (
        updateClientDto.fechaCreacionEmpresa &&
        updateClientDto.fechaCreacionEmpresa !== ''
      ) {
        client.fechaCreacionEmpresa = new Date(
          updateClientDto.fechaCreacionEmpresa,
        );
      } else {
        client.fechaCreacionEmpresa = undefined;
      }
    }

    // Re-autogenerar dirección completa si hay cambios
    const hasAddressChanges =
      updateClientDto.direccionBase !== undefined ||
      updateClientDto.barrio !== undefined ||
      updateClientDto.ciudad !== undefined ||
      updateClientDto.departamento !== undefined ||
      updateClientDto.pais !== undefined;

    if (hasAddressChanges) {
      client.direccionCompleta = this._generateFullAddress(client);
    }

    const updatedClient = await this.clientRepository.save(client);

    // Evento WebSocket: cliente actualizado
    this.realtime.emitEntityUpdate('clients', 'updated', updatedClient);

    return updatedClient;
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepository.remove(client);

    // Evento WebSocket: cliente eliminado
    this.realtime.emitEntityUpdate('clients', 'deleted', { id });
  }

  async findByUsuarioContacto(usuarioId: number): Promise<Client[]> {
    return await this.clientRepository
      .createQueryBuilder('client')
      .innerJoin('client.usuariosContacto', 'usuario')
      .where('usuario.usuarioId = :usuarioId', { usuarioId })
      .leftJoinAndSelect('client.areas', 'areas')
      .leftJoinAndSelect('areas.subAreas', 'subAreas')
      .leftJoinAndSelect('client.images', 'images')
      .orderBy('client.nombre', 'ASC')
      .getMany();
  }

  async addUsuarioContacto(
    idCliente: number,
    usuarioId: number,
  ): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { idCliente },
      relations: ['usuariosContacto'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no encontrado`);
    }

    const user = await this.userRepository.findOne({
      where: { usuarioId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
    }

    // Verificar si el usuario ya es contacto
    if (client.usuariosContacto.some((u) => u.usuarioId === usuarioId)) {
      throw new ConflictException('El usuario ya es contacto de este cliente');
    }

    client.usuariosContacto.push(user);
    const updatedClient = await this.clientRepository.save(client);

    // Evento WebSocket: contacto agregado
    this.realtime.emitGlobal('clients.contactAdded', {
      clientId: idCliente,
      userId: usuarioId,
      client: updatedClient,
    });

    return updatedClient;
  }

  async removeUsuarioContacto(
    idCliente: number,
    usuarioId: number,
  ): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { idCliente },
      relations: ['usuariosContacto'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no encontrado`);
    }

    // Verificar que haya al menos un usuario contacto
    if (client.usuariosContacto.length <= 1) {
      throw new BadRequestException(
        'El cliente debe tener al menos un usuario contacto',
      );
    }

    // Filtrar el usuario a remover
    const initialCount = client.usuariosContacto.length;
    client.usuariosContacto = client.usuariosContacto.filter(
      (u) => u.usuarioId !== usuarioId,
    );

    if (client.usuariosContacto.length === initialCount) {
      throw new NotFoundException('El usuario no es contacto de este cliente');
    }

    const updatedClient = await this.clientRepository.save(client);

    // Evento WebSocket: contacto removido
    this.realtime.emitGlobal('clients.contactRemoved', {
      clientId: idCliente,
      userId: usuarioId,
      client: updatedClient,
    });

    return updatedClient;
  }

  async getClientesByUsuario(usuarioId: number): Promise<Client[]> {
    return this.clientRepository
      .createQueryBuilder('client')
      .innerJoin('client.usuariosContacto', 'usuario')
      .where('usuario.usuarioId = :usuarioId', { usuarioId })
      .leftJoinAndSelect('client.areas', 'areas')
      .leftJoinAndSelect('areas.subAreas', 'subAreas')
      .leftJoinAndSelect('client.images', 'images')
      .orderBy('client.nombre', 'ASC')
      .getMany();
  }
}
