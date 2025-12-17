import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  /**
   * Crea un cliente empresa.
   * - Si el rol es Cliente: usa su propio usuario como contacto.
   * - Si es Admin/Secretaria: debe enviar idUsuarioContacto.
   */
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

    let usuarioContacto: User; // ✅ Garantizamos que aquí solo entra un User válido

    if (roleName === 'Cliente') {
      // CLIENTE: se usa a sí mismo como usuario contacto
      const uc = await this.userRepository.findOne({
        where: { usuarioId: currentUser.userId },
      });

      if (!uc) {
        throw new NotFoundException(
          `Usuario autenticado con ID ${currentUser.userId} no encontrado`,
        );
      }

      usuarioContacto = uc;
      createClientDto.idUsuarioContacto = currentUser.userId;

      // Opcionalmente forzamos algunos campos si vienen vacíos
      if (!createClientDto.contacto) {
        createClientDto.contacto = `${uc.nombre} ${uc.apellido || ''}`.trim();
      }
      if (!createClientDto.email) {
        createClientDto.email = uc.email;
      }
      if (!createClientDto.telefono && uc.telefono) {
        createClientDto.telefono = uc.telefono;
      }
    } else {
      // ADMIN / SECRETARIA: deben enviar idUsuarioContacto
      if (!createClientDto.idUsuarioContacto) {
        throw new BadRequestException(
          'El ID de usuario contacto es requerido',
        );
      }

      const uc = await this.userRepository.findOne({
        where: { usuarioId: createClientDto.idUsuarioContacto },
      });

      if (!uc) {
        throw new NotFoundException(
          `Usuario contacto con ID ${createClientDto.idUsuarioContacto} no encontrado`,
        );
      }

      usuarioContacto = uc;
    }

    const client = this.clientRepository.create({
      ...createClientDto,
      usuarioContacto, // ✅ aquí ya es tipo User, sin null
    });

    const savedClient = await this.clientRepository.save(client);
    this.logger.log(
      `Cliente creado: ${savedClient.idCliente} - ${savedClient.nombre}`,
    );
    return savedClient;
  }

  async findAll(): Promise<Client[]> {
    return await this.clientRepository.find({
      relations: ['usuarioContacto', 'areas', 'areas.subAreas'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: id },
      relations: ['usuarioContacto', 'areas', 'areas.subAreas'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  async findByNit(nit: string): Promise<Client | null> {
    return await this.clientRepository.findOne({
      where: { nit },
      relations: ['usuarioContacto', 'areas', 'areas.subAreas'],
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

    // Cambiar usuario contacto si viene un ID nuevo
    if (
      updateClientDto.idUsuarioContacto &&
      updateClientDto.idUsuarioContacto !== client.idUsuarioContacto
    ) {
      const usuarioContacto = await this.userRepository.findOne({
        where: { usuarioId: updateClientDto.idUsuarioContacto },
      });

      if (!usuarioContacto) {
        throw new NotFoundException(
          `Usuario contacto con ID ${updateClientDto.idUsuarioContacto} no encontrado`,
        );
      }

      client.usuarioContacto = usuarioContacto;
    }

    Object.assign(client, updateClientDto);
    return await this.clientRepository.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepository.remove(client);
    this.logger.log(`Cliente eliminado: ${id}`);
  }

  async findByUsuarioContacto(usuarioId: number): Promise<Client[]> {
    return await this.clientRepository.find({
      where: { idUsuarioContacto: usuarioId },
      relations: ['usuarioContacto', 'areas', 'areas.subAreas'],
      order: { nombre: 'ASC' },
    });
  }
}