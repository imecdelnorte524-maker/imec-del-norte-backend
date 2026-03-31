// src/services/terms.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TermsConditions, TermsType } from './entities/terms.entity';
import { CreateTermsDto } from './dto/create-terms.dto';
import { TermsResponseDto } from './dto/response-terms';
import { UpdateTermsDto } from './dto/update-terms.dto';

@Injectable()
export class TermsService {
  constructor(
    @InjectRepository(TermsConditions)
    private termsRepository: Repository<TermsConditions>,
  ) {}

  async create(
    createTermsDto: CreateTermsDto,
    userId: string,
  ): Promise<TermsResponseDto> {
    const existing = await this.termsRepository.findOne({
      where: { type: createTermsDto.type },
    });

    if (existing) {
      throw new ConflictException(
        `Terms for type ${createTermsDto.type} already exist`,
      );
    }

    const terms = this.termsRepository.create({
      ...createTermsDto,
      createdBy: userId,
      updatedBy: userId,
      version: 1,
    });

    const saved = await this.termsRepository.save(terms);
    return this.toResponseDto(saved);
  }

  async findAll(): Promise<TermsResponseDto[]> {
    const terms = await this.termsRepository.find({
      where: { isActive: true },
      order: { type: 'ASC' },
    });
    return terms.map((term) => this.toResponseDto(term));
  }

  async findByType(type: TermsType): Promise<TermsResponseDto> {
    const terms = await this.termsRepository.findOne({
      where: { type, isActive: true },
    });

    if (!terms) {
      // Return default terms if not found
      return this.getDefaultTerms(type);
    }

    return this.toResponseDto(terms);
  }

  async update(
    type: TermsType,
    updateTermsDto: UpdateTermsDto,
    userId: string,
  ): Promise<TermsResponseDto> {
    const terms = await this.termsRepository.findOne({
      where: { type },
    });

    if (!terms) {
      throw new NotFoundException(`Terms for type ${type} not found`);
    }

    // Increment version on update
    const updated = await this.termsRepository.save({
      ...terms,
      ...updateTermsDto,
      version: terms.version + 1,
      updatedBy: userId,
    });

    return this.toResponseDto(updated);
  }

  async delete(type: TermsType): Promise<void> {
    const result = await this.termsRepository.delete({ type });
    if (result.affected === 0) {
      throw new NotFoundException(`Terms for type ${type} not found`);
    }
  }

  private toResponseDto(terms: TermsConditions): TermsResponseDto {
    return {
      id: terms.id,
      type: terms.type,
      title: terms.title,
      description: terms.description,
      items: terms.items,
      version: terms.version,
      isActive: terms.isActive,
      createdAt: terms.createdAt,
      updatedAt: terms.updatedAt,
    };
  }

  private getDefaultTerms(type: TermsType): TermsResponseDto {
    const defaults = {
      [TermsType.DATA_PRIVACY]: {
        title: 'Aceptación de Tratamiento de Datos Personales',
        description:
          'Autorizo de manera libre, previa, expresa e informada el tratamiento de mis datos personales conforme a lo establecido en la Ley 1581 de 2012 y demás normas aplicables.',
        items: [
          'Reconozco que la información aquí suministrada será utilizada exclusivamente para fines relacionados con la gestión administrativa, comercial y legal de la empresa.',
          'Declaro que he leído y comprendido la Política de Privacidad y Protección de Datos.',
          'Manifiesto mi consentimiento para el tratamiento de la información proporcionada.',
        ],
      },
      [TermsType.ATS]: {
        title: 'Términos y Condiciones - Análisis de Trabajo Seguro',
        description: null,
        items: [
          'He leído y comprendido los términos y condiciones.',
          'He identificado los riesgos asociados al trabajo.',
          'Cuento con el equipo de protección personal necesario.',
          'Conozco los procedimientos de emergencia.',
          'Acepto realizar el trabajo de acuerdo a los estándares de seguridad.',
        ],
      },
      [TermsType.HEIGHT_WORK]: {
        title: 'Términos y Condiciones - Trabajo en Alturas',
        description: null,
        items: [
          'He recibido entrenamiento para trabajo en alturas.',
          'Conozco y utilizaré los elementos de protección personal indicados.',
          'He verificado el estado de los equipos y sistemas de protección.',
          'Informaré inmediatamente cualquier condición insegura.',
          'Acepto seguir los procedimientos establecidos para trabajo en alturas.',
          'Declaro que no tengo condiciones médicas que me contraindiquen realizar trabajo en alturas.',
          'Me comprometo a utilizar el arnés de seguridad y línea de vida en todo momento.',
        ],
      },
      [TermsType.PREOPERATIONAL_FORM]: {
        title: 'Términos y Condiciones - Checklist Preoperacional',
        description: null,
        items: [
          'He verificado el estado de la herramienta según el checklist preoperacional.',
          'Los resultados de la inspección son veraces y completos.',
          'Reportaré cualquier anomalía encontrada al supervisor inmediato.',
          'No utilizaré herramientas en mal estado o con deficiencias identificadas.',
          'Acepto seguir los procedimientos establecidos para uso de herramientas.',
          'Soy responsable de mantener la herramienta en condiciones seguras durante su uso.',
        ],
      },
    };

    const defaultContent = defaults[type] || defaults[TermsType.DATA_PRIVACY];

    return {
      id: 0,
      type,
      title: defaultContent.title,
      description: defaultContent.description,
      items: defaultContent.items,
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
