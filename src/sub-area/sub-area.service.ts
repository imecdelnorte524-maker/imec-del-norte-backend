import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SubArea } from './entities/sub-area.entity';
import { Area } from '../area/entities/area.entity';
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class SubAreaService {
  private readonly logger = new Logger(SubAreaService.name);

  constructor(
    @InjectRepository(SubArea)
    private subAreaRepository: Repository<SubArea>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    private readonly realtime: RealtimeService,
  ) {}

  async create(createSubAreaDto: CreateSubAreaDto): Promise<SubArea> {
    const area = await this.areaRepository.findOne({
      where: { idArea: createSubAreaDto.areaId },
      relations: ['cliente', 'cliente.usuariosContacto'],
    });

    if (!area) {
      throw new NotFoundException(
        `Área con ID ${createSubAreaDto.areaId} no encontrada`,
      );
    }

    let parentSubArea: SubArea | null = null;

    if (createSubAreaDto.parentSubAreaId) {
      parentSubArea = await this.subAreaRepository.findOne({
        where: { idSubArea: createSubAreaDto.parentSubAreaId },
      });

      if (!parentSubArea) {
        throw new NotFoundException(
          `Subárea padre con ID ${createSubAreaDto.parentSubAreaId} no encontrada`,
        );
      }

      if (parentSubArea.areaId !== createSubAreaDto.areaId) {
        throw new BadRequestException(
          'La subárea padre debe pertenecer a la misma área',
        );
      }
    }

    const whereClause: any = {
      nombreSubArea: createSubAreaDto.nombreSubArea,
      areaId: createSubAreaDto.areaId,
    };

    if (createSubAreaDto.parentSubAreaId) {
      whereClause.parentSubAreaId = createSubAreaDto.parentSubAreaId;
    } else {
      whereClause.parentSubAreaId = null;
    }

    const existingSubArea = await this.subAreaRepository.findOne({
      where: whereClause,
    });

    if (existingSubArea) {
      throw new ConflictException(
        'Ya existe una subárea con este nombre para esta área y subárea padre',
      );
    }

    const subArea = this.subAreaRepository.create({
      ...createSubAreaDto,
      area: area,
      parentSubArea: parentSubArea || undefined,
    });

    const savedSubArea = await this.subAreaRepository.save(subArea);

    const full = await this.findOne(savedSubArea.idSubArea);
    this.realtime.emitEntityUpdate('subAreas', 'created', full);

    return full;
  }

  async findAll(): Promise<SubArea[]> {
    return await this.subAreaRepository.find({
      relations: ['area', 'area.cliente', 'area.cliente.usuariosContacto'],
      order: { nombreSubArea: 'ASC' },
    });
  }

  async findOne(id: number): Promise<SubArea> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: id },
      relations: ['area', 'area.cliente', 'area.cliente.usuariosContacto'],
    });

    if (!subArea) {
      throw new NotFoundException(`Subárea con ID ${id} no encontrada`);
    }

    return subArea;
  }

  async findByAreaId(areaId: number): Promise<SubArea[]> {
    return await this.subAreaRepository.find({
      where: { areaId: areaId },
      relations: ['area', 'area.cliente', 'area.cliente.usuariosContacto'],
      order: { nombreSubArea: 'ASC' },
    });
  }

  async findByClientId(clientId: number): Promise<SubArea[]> {
    return await this.subAreaRepository
      .createQueryBuilder('subArea')
      .leftJoinAndSelect('subArea.area', 'area')
      .leftJoinAndSelect('area.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuariosContacto', 'usuariosContacto')
      .where('cliente.idCliente = :clientId', { clientId })
      .orderBy('subArea.nombreSubArea', 'ASC')
      .getMany();
  }

  async update(
    id: number,
    updateSubAreaDto: UpdateSubAreaDto,
  ): Promise<SubArea> {
    const subArea = await this.findOne(id);

    if (updateSubAreaDto.areaId && updateSubAreaDto.areaId !== subArea.areaId) {
      const area = await this.areaRepository.findOne({
        where: { idArea: updateSubAreaDto.areaId },
        relations: ['cliente', 'cliente.usuariosContacto'],
      });

      if (!area) {
        throw new NotFoundException(
          `Área con ID ${updateSubAreaDto.areaId} no encontrada`,
        );
      }
      subArea.area = area;
      subArea.areaId = updateSubAreaDto.areaId;
    }

    if (
      updateSubAreaDto.parentSubAreaId !== undefined &&
      updateSubAreaDto.parentSubAreaId !== subArea.parentSubAreaId
    ) {
      if (updateSubAreaDto.parentSubAreaId === id) {
        throw new BadRequestException(
          'Una subárea no puede ser padre de sí misma',
        );
      }

      if (updateSubAreaDto.parentSubAreaId) {
        const parentSubArea = await this.subAreaRepository.findOne({
          where: { idSubArea: updateSubAreaDto.parentSubAreaId },
        });

        if (!parentSubArea) {
          throw new NotFoundException(
            `Subárea padre con ID ${updateSubAreaDto.parentSubAreaId} no encontrada`,
          );
        }

        const areaIdForParent = updateSubAreaDto.areaId || subArea.areaId;

        if (parentSubArea.areaId !== areaIdForParent) {
          throw new BadRequestException(
            'La subárea padre debe pertenecer a la misma área',
          );
        }

        subArea.parentSubArea = parentSubArea;
        subArea.parentSubAreaId = parentSubArea.idSubArea;
      }
    }

    if (
      updateSubAreaDto.nombreSubArea &&
      updateSubAreaDto.nombreSubArea !== subArea.nombreSubArea
    ) {
      const areaId = updateSubAreaDto.areaId || subArea.areaId;
      const parentSubAreaIdForCheck =
        updateSubAreaDto.parentSubAreaId !== undefined
          ? updateSubAreaDto.parentSubAreaId
          : (subArea.parentSubAreaId ?? null);

      const whereCondition: any = {
        nombreSubArea: updateSubAreaDto.nombreSubArea,
        areaId: areaId,
      };

      if (parentSubAreaIdForCheck === null) {
        whereCondition.parentSubAreaId = IsNull();
      } else {
        whereCondition.parentSubAreaId = parentSubAreaIdForCheck;
      }

      const existingSubArea = await this.subAreaRepository.findOne({
        where: whereCondition,
      });

      if (existingSubArea && existingSubArea.idSubArea !== id) {
        throw new ConflictException(
          'Ya existe una subárea con este nombre para esta área y subárea padre',
        );
      }
    }

    Object.assign(subArea, updateSubAreaDto);
    const saved = await this.subAreaRepository.save(subArea);

    const full = await this.findOne(saved.idSubArea);
    this.realtime.emitEntityUpdate('subAreas', 'updated', full);

    return full;
  }

  async remove(id: number): Promise<void> {
    const subArea = await this.findOne(id);
    await this.subAreaRepository.remove(subArea);

    this.realtime.emitEntityUpdate('subAreas', 'deleted', { id });
  }

  async getHierarchy(subAreaId: number): Promise<any> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: subAreaId },
      relations: ['area', 'area.cliente', 'area.cliente.usuariosContacto'],
    });

    if (!subArea) {
      throw new NotFoundException(`Subárea con ID ${subAreaId} no encontrada`);
    }

    const primerUsuarioContacto =
      subArea.area.cliente.usuariosContacto?.[0] || null;

    return {
      subArea: {
        idSubArea: subArea.idSubArea,
        nombreSubArea: subArea.nombreSubArea,
      },
      area: {
        idArea: subArea.area.idArea,
        nombreArea: subArea.area.nombreArea,
      },
      cliente: {
        idCliente: subArea.area.cliente.idCliente,
        nombre: subArea.area.cliente.nombre,
        nit: subArea.area.cliente.nit,
      },
      usuarioContacto: primerUsuarioContacto
        ? {
            usuarioId: primerUsuarioContacto.usuarioId,
            nombre: primerUsuarioContacto.nombre,
            email: primerUsuarioContacto.email,
          }
        : null,
    };
  }

  async findByParentSubAreaId(parentSubAreaId: number): Promise<SubArea[]> {
    return await this.subAreaRepository.find({
      where: { parentSubAreaId },
      relations: ['area', 'area.cliente'],
      order: { createdAt: 'ASC' },
    });
  }

  async buildAreaTree(areaId: number): Promise<any> {
    const area = await this.areaRepository.findOne({
      where: { idArea: areaId },
      relations: ['cliente'],
    });
    if (!area) {
      throw new NotFoundException(`Área con ID ${areaId} no encontrada`);
    }

    const rootSubAreas = await this.subAreaRepository.find({
      where: { areaId, parentSubAreaId: IsNull() },
      relations: ['children'],
      order: { createdAt: 'ASC' },
    });

    const populateChildren = async (subArea: SubArea): Promise<any> => {
      const children = await this.subAreaRepository.find({
        where: { parentSubAreaId: subArea.idSubArea },
        relations: ['children'],
        order: { createdAt: 'ASC' },
      });
      const populatedChildren = await Promise.all(
        children.map(populateChildren),
      );
      return {
        id: subArea.idSubArea,
        nombre: subArea.nombreSubArea,
        children: populatedChildren,
      };
    };

    const tree = await Promise.all(rootSubAreas.map(populateChildren));

    return {
      area: {
        idArea: area.idArea,
        nombreArea: area.nombreArea,
      },
      cliente: {
        idCliente: area.cliente.idCliente,
        nombre: area.cliente.nombre,
      },
      subAreas: tree,
    };
  }
}
