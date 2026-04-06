import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TermsConditions } from './entities/terms.entity';
import { CreateTermsDto } from './dto/create-terms.dto';
import { TermsResponseDto } from './dto/response-terms';
import { UpdateTermsDto } from './dto/update-terms.dto';
import { TermsType } from '../shared';

@Injectable()
export class TermsService {
  constructor(
    @InjectRepository(TermsConditions)
    private termsRepository: Repository<TermsConditions>,
  ) { }

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
      isActive: createTermsDto.isActive ?? true,
    });

    const saved = await this.termsRepository.save(terms);
    return this.toResponseDto(saved);
  }

  async findAll(): Promise<TermsResponseDto[]> {
    const terms = await this.termsRepository.find({
      order: { type: 'ASC' },
    });
    return terms.map((term) => this.toResponseDto(term));
  }

  async findByType(type: TermsType): Promise<TermsResponseDto> {
    const terms = await this.termsRepository.findOne({
      where: { type, isActive: true },
    });

    if (!terms) {
      throw new NotFoundException(`Terms for type ${type} not found`);
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
}