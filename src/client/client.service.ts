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

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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

  async create(
    createClientDto: CreateClientDto,
    currentUser: any,
  ): Promise<Client> {
    const roleName = this.getRoleName(currentUser);

    // Validar NIT único
    const existingClient = await this.clientRepository.findOne({
      where: { nit: createClientDto.nit },
    });
    if (existingClient) {
      throw new ConflictException('Ya existe un cliente con este NIT');
    }

    // Validar email único
    const existingClientByEmail = await this.clientRepository.findOne({
      where: { email: createClientDto.email },
    });
    if (existingClientByEmail) {
      throw new ConflictException('Ya existe un cliente con este email');
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
        createClientDto.contacto = `${user.nombre} ${user.apellido || ''}`.trim();
      }
      if (!createClientDto.email) {
        createClientDto.email = user.email;
      }
      if (!createClientDto.telefono && user.telefono) {
        createClientDto.telefono = user.telefono;
      }
    } else {
      // Para Administrador/Secretaria, usar los IDs proporcionados
      if (createClientDto.usuariosContactoIds && createClientDto.usuariosContactoIds.length > 0) {
        usuariosContacto = await this.userRepository.find({
          where: { usuarioId: In(createClientDto.usuariosContactoIds) },
        });

        if (usuariosContacto.length !== createClientDto.usuariosContactoIds.length) {
          const foundIds = usuariosContacto.map(u => u.usuarioId);
          const missingIds = createClientDto.usuariosContactoIds.filter(id => !foundIds.includes(id));
          throw new NotFoundException(
            `Los siguientes usuarios contacto no existen: ${missingIds.join(', ')}`,
          );
        }
      } else {
        throw new BadRequestException('Debe proporcionar al menos un usuario contacto');
      }
    }

    // Crear la instancia del cliente
    const client = this.clientRepository.create({
      ...createClientDto,
      usuariosContacto,
    });

    // Autogenerar dirección completa
    client.direccionCompleta = this._generateFullAddress(client);

    const savedClient = await this.clientRepository.save(client);
    this.logger.log(
      `Cliente creado: ${savedClient.idCliente} - ${savedClient.nombre}`,
    );
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
      relations: ['usuariosContacto', 'areas', 'areas.subAreas', 'images', 'bodegas'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  async findByNit(nit: string): Promise<Client | null> {
    return await this.clientRepository.findOne({
      where: { nit },
      relations: ['usuariosContacto', 'areas', 'areas.subAreas', 'images', 'bodegas'],
    });
  }

  async update(id: number, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (updateClientDto.nit && updateClientDto.nit !== client.nit) {
      const existingClient = await this.findByNit(updateClientDto.nit);
      if (existingClient) {
        throw new ConflictException('Ya existe otro cliente con este NIT');
      }
    }

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
        throw new BadRequestException('Debe haber al menos un usuario contacto');
      }

      const usuariosContacto = await this.userRepository.find({
        where: { usuarioId: In(updateClientDto.usuariosContactoIds) },
      });

      if (usuariosContacto.length !== updateClientDto.usuariosContactoIds.length) {
        const foundIds = usuariosContacto.map(u => u.usuarioId);
        const missingIds = updateClientDto.usuariosContactoIds.filter(id => !foundIds.includes(id));
        throw new NotFoundException(
          `Los siguientes usuarios contacto no existen: ${missingIds.join(', ')}`,
        );
      }

      client.usuariosContacto = usuariosContacto;
    }

    Object.assign(client, updateClientDto);

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

    return await this.clientRepository.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepository.remove(client);
    this.logger.log(`Cliente eliminado: ${id}`);
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

  async addUsuarioContacto(idCliente: number, usuarioId: number): Promise<Client> {
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
    if (client.usuariosContacto.some(u => u.usuarioId === usuarioId)) {
      throw new ConflictException('El usuario ya es contacto de este cliente');
    }

    client.usuariosContacto.push(user);
    return this.clientRepository.save(client);
  }

  async removeUsuarioContacto(idCliente: number, usuarioId: number): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { idCliente },
      relations: ['usuariosContacto'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no encontrado`);
    }

    // Verificar que haya al menos un usuario contacto
    if (client.usuariosContacto.length <= 1) {
      throw new BadRequestException('El cliente debe tener al menos un usuario contacto');
    }

    // Filtrar el usuario a remover
    const initialCount = client.usuariosContacto.length;
    client.usuariosContacto = client.usuariosContacto.filter(
      u => u.usuarioId !== usuarioId,
    );

    if (client.usuariosContacto.length === initialCount) {
      throw new NotFoundException('El usuario no es contacto de este cliente');
    }

    return this.clientRepository.save(client);
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