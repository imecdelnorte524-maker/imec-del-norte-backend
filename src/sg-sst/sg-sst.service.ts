// src/sg-sst/sg-sst.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash, randomInt } from 'crypto';

import { AtsReport } from './entities/ats-report.entity';
import { HeightWork } from './entities/height-work.entity';
import { PreoperationalCheck } from './entities/preoperational-check.entity';
import { Signature, SignatureType } from './entities/signature.entity';
import { SignOtp } from './entities/sign-otp.entity';
import { Form } from './entities/form.entity';

import { CreateAtsDto } from './dto/create-ats.dto';
import { CreateHeightWorkDto } from './dto/create-height-work.dto';
import {
  CreatePreoperationalDto,
  PreoperationalCheckDto,
} from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { CreatePreoperationalChecklistTemplateDto } from './dto/create-preoperational-checklist-template.dto';
import { RejectFormDto } from './dto/reject-form.dto';

import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatus, FormStatus, FormType } from '../shared/index';
import { PreoperationalChecklistTemplate } from './entities/preoperational-checklist-template.entity';
import { PreoperationalChecklistParameter } from './entities/preoperational-checklist-parameter.entity';

import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ConfigService } from '@nestjs/config';
import { PdfService } from '../pdf/pdf.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { PdfTemplateType } from '../pdf/constants/wkhtmltopdf.config';
import { buildAtsReportParams } from '../../templates/report/ats-report-html.helper';
import { buildHeightWorkReportParams } from '../../templates/report/height-work-report-html.helper';
import { buildPreoperationalReportParams } from '../../templates/report/preoperational-report-html.helper';
import { AuthorizeHeightWorkDto } from './dto/authorize-height-work.dto';

@Injectable()
export class SgSstService {
  private readonly OTP_TTL_MINUTES = 5;
  private readonly OTP_MAX_ATTEMPTS = 3;

  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(AtsReport)
    private atsRepository: Repository<AtsReport>,
    @InjectRepository(HeightWork)
    private heightWorkRepository: Repository<HeightWork>,
    @InjectRepository(PreoperationalCheck)
    private preoperationalCheckRepository: Repository<PreoperationalCheck>,
    @InjectRepository(Signature)
    private signatureRepository: Repository<Signature>,
    @InjectRepository(SignOtp)
    private signOtpRepository: Repository<SignOtp>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(PreoperationalChecklistTemplate)
    private preopTemplateRepo: Repository<PreoperationalChecklistTemplate>,
    @InjectRepository(PreoperationalChecklistParameter)
    private preopParamRepo: Repository<PreoperationalChecklistParameter>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
  ) {}

  // ========== ATS METHODS ==========
  async createAts(createAtsDto: CreateAtsDto) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createAtsDto.workOrderId },
        relations: [
          'cliente',
          'clienteEmpresa',
          'technicians',
          'technicians.technician',
        ],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createAtsDto.workOrderId} no encontrada`,
        );
      }

      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) => tech.tecnicoId === createAtsDto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
        );
      }

      if (workOrder.estado === WorkOrderStatus.CANCELED) {
        throw new BadRequestException(
          'No se puede crear un ATS para una orden cancelada',
        );
      }

      const empresa = workOrder.clienteEmpresa;
      const persona = workOrder.cliente;

      const clientId = empresa ? empresa.idCliente : undefined;
      const clientName = empresa?.nombre || persona?.nombre || '';
      const clientNit = empresa?.nit || undefined;

      const form = this.formRepository.create({
        formType: FormType.ATS,
        status: FormStatus.DRAFT,
        userId: createAtsDto.userId,
        createdBy: createAtsDto.createdBy,
        workOrderId: workOrder.ordenId,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      const atsReport = this.atsRepository.create({
        formId: savedForm.id,
        workerName: createAtsDto.workerName,
        workerIdentification: createAtsDto.workerIdentification,
        position: createAtsDto.position,
        clientId,
        clientName,
        clientNit,
        area: createAtsDto.area,
        subArea: createAtsDto.subArea,
        workToPerform: createAtsDto.workToPerform,
        location: createAtsDto.location,
        startTime: createAtsDto.startTime,
        endTime: createAtsDto.endTime,
        date: createAtsDto.date,
        observations: createAtsDto.observations,
        selectedRisks: createAtsDto.selectedRisks,
        requiredPpe: createAtsDto.requiredPpe,
      });
      const savedAts = await queryRunner.manager.save(AtsReport, atsReport);

      await queryRunner.commitTransaction();

      this.notificationsGateway.server.emit('forms.created', {
        formType: FormType.ATS,
        form: savedForm,
      });

      return {
        form: savedForm,
        ats: savedAts,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========== HEIGHT WORK METHODS ==========
  async createHeightWork(createHeightWorkDto: CreateHeightWorkDto) {
    const workOrder = await this.workOrderRepository.findOne({
      where: { ordenId: createHeightWorkDto.workOrderId },
      relations: ['technicians', 'technicians.technician'],
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${createHeightWorkDto.workOrderId} no encontrada`,
      );
    }

    const isAssignedTechnician = workOrder.technicians?.some(
      (tech) => tech.tecnicoId === createHeightWorkDto.userId,
    );

    if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
      throw new BadRequestException(
        'La orden de trabajo no está asignada a este técnico',
      );
    }

    const form = this.formRepository.create({
      formType: FormType.HEIGHT_WORK,
      status: FormStatus.DRAFT,
      userId: createHeightWorkDto.userId,
      createdBy: createHeightWorkDto.createdBy,
      workOrderId: workOrder.ordenId,
    });

    const savedForm = await this.formRepository.save(form);

    const heightWork = this.heightWorkRepository.create({
      formId: savedForm.id,
      workerName: createHeightWorkDto.workerName,
      identification: createHeightWorkDto.identification,
      position: createHeightWorkDto.position,
      workDescription: createHeightWorkDto.workDescription,
      location: createHeightWorkDto.location,
      estimatedTime: createHeightWorkDto.estimatedTime,
      protectionElements: createHeightWorkDto.protectionElements,
      physicalCondition: createHeightWorkDto.physicalCondition,
      instructionsReceived: createHeightWorkDto.instructionsReceived,
      fitForHeightWork: createHeightWorkDto.fitForHeightWork,
      authorizerName: createHeightWorkDto.authorizerName,
      authorizerIdentification: createHeightWorkDto.authorizerIdentification,
    });

    const savedHeightWork = await this.heightWorkRepository.save(heightWork);

    this.notificationsGateway.server.emit('forms.created', {
      formType: FormType.HEIGHT_WORK,
      form: savedForm,
    });

    return { form: savedForm, heightWork: savedHeightWork };
  }

  // ========== PREOPERATIONAL METHODS ==========
  async createPreoperational(createPreoperationalDto: CreatePreoperationalDto) {
    const workOrder = await this.workOrderRepository.findOne({
      where: { ordenId: createPreoperationalDto.workOrderId },
      relations: ['technicians', 'technicians.technician'],
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${createPreoperationalDto.workOrderId} no encontrada`,
      );
    }

    const isAssignedTechnician = workOrder.technicians?.some(
      (tech) => tech.tecnicoId === createPreoperationalDto.userId,
    );

    if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
      throw new BadRequestException(
        'La orden de trabajo no está asignada a este técnico',
      );
    }

    const form = this.formRepository.create({
      formType: FormType.PREOPERATIONAL,
      status: FormStatus.DRAFT,
      equipmentTool: createPreoperationalDto.equipmentTool,
      userId: createPreoperationalDto.userId,
      createdBy: createPreoperationalDto.createdBy,
      workOrderId: workOrder.ordenId,
    });

    const savedForm = await this.formRepository.save(form);

    const checks = createPreoperationalDto.checks.map(
      (checkDto: PreoperationalCheckDto) =>
        this.preoperationalCheckRepository.create({
          formId: savedForm.id,
          parameter: checkDto.parameter,
          value: checkDto.value,
          observations: checkDto.observations,
        }),
    );

    const savedChecks = await this.preoperationalCheckRepository.save(checks);

    this.notificationsGateway.server.emit('forms.created', {
      formType: FormType.PREOPERATIONAL,
      form: savedForm,
    });

    return { form: savedForm, checks: savedChecks };
  }

  // ========== SIGNATURE METHODS ==========
  async signForm(
    formId: number,
    currentUserId: number,
    clientIp: string,
    userAgent: string,
    signFormDto: SignFormDto,
  ) {
    const form = await this.formRepository.findOne({ where: { id: formId } });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    const signatureType = this.mapSignerTypeToSignatureType(
      signFormDto.signerType,
    );

    const existingSignature = await this.signatureRepository.findOne({
      where: {
        formId,
        signatureType,
        userId: currentUserId,
      },
    });

    if (existingSignature) {
      throw new BadRequestException('El usuario ya ha firmado este formulario');
    }

    await this.verifyAndConsumeOtp(
      formId,
      signFormDto.signerType,
      currentUserId,
      signFormDto.otpCode,
    );

    const user = await this.userRepository.findOne({
      where: { usuarioId: currentUserId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userNameReal = `${user.nombre} ${user.apellido ?? ''}`.trim();

    const signature = this.signatureRepository.create({
      formId,
      signatureType,
      userId: currentUserId,
      userName: userNameReal,
      signatureData: signFormDto.signatureData,
      ip: clientIp,
      userAgent,
      method: 'OTP_EMAIL',
      contactSnapshot: user.email ?? '', // string, sin null
    });

    await this.signatureRepository.save(signature);

    if (signFormDto.signerType === SignerType.TECHNICIAN) {
      form.technicianSignatureDate = new Date();
      form.status = FormStatus.PENDING_SST;
    } else if (signFormDto.signerType === SignerType.SST) {
      form.sstSignatureDate = new Date();
      form.status = FormStatus.COMPLETED;
      await this.generateFormPdf(form.id);
    }

    await this.formRepository.save(form);

    this.notificationsGateway.server.emit('forms.updated', form);

    return { message: 'Firma registrada exitosamente', form };
  }

  // ========== AUTORIZAR TRABAJO EN ALTURAS ==========
  async authorizeHeightWork(
    formId: number,
    authorizeDto: AuthorizeHeightWorkDto,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const form = await this.formRepository.findOne({
        where: { id: formId },
        relations: ['heightWork'],
      });

      if (!form) {
        throw new NotFoundException('Formulario no encontrado');
      }

      if (form.formType !== FormType.HEIGHT_WORK) {
        throw new BadRequestException(
          'Este formulario no es un Trabajo en Alturas',
        );
      }

      if (form.status !== FormStatus.PENDING_SST) {
        throw new BadRequestException(
          'Este formulario no está pendiente de autorización SST',
        );
      }

      const existingSstSignature = await this.signatureRepository.findOne({
        where: {
          formId: formId,
          signatureType: SignatureType.SST,
        },
      });

      if (existingSstSignature) {
        throw new BadRequestException(
          'Este formulario ya ha sido autorizado por SST',
        );
      }

      const heightWork = await this.heightWorkRepository.findOne({
        where: { formId: formId },
      });

      if (!heightWork) {
        throw new NotFoundException(
          'Registro de Trabajo en Alturas no encontrado',
        );
      }

      heightWork.physicalCondition = authorizeDto.physicalCondition;
      heightWork.instructionsReceived = authorizeDto.instructionsReceived;
      heightWork.fitForHeightWork = authorizeDto.fitForHeightWork;
      heightWork.authorizerName = authorizeDto.authorizerName;
      heightWork.authorizerIdentification =
        authorizeDto.authorizerIdentification;

      await queryRunner.manager.save(HeightWork, heightWork);

      await queryRunner.manager.save(Form, form);

      await queryRunner.commitTransaction();

      this.notificationsGateway.server.emit('forms.updated', form);

      return {
        form,
        heightWork,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========== GET METHODS ==========
  async findAllForms(userId?: number) {
    const where = userId ? { createdBy: userId } : {};
    return this.formRepository.find({
      where,
      relations: [
        'atsReport',
        'heightWork',
        'preoperationalChecks',
        'signatures',
        'user',
        'workOrder',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findFormById(id: number) {
    const form = await this.formRepository.findOne({
      where: { id },
      relations: [
        'atsReport',
        'heightWork',
        'preoperationalChecks',
        'signatures',
        'user',
        'workOrder',
      ],
    });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    return form;
  }

  async getFormsByStatus(status: FormStatus) {
    return this.formRepository.find({
      where: { status },
      relations: [
        'atsReport',
        'heightWork',
        'signatures',
        'user',
        'preoperationalChecks',
        'workOrder',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ========== UTILITY METHODS ==========
  async canEditForm(formId: number, userId: number): Promise<boolean> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: ['signatures'],
    });

    if (!form) return false;

    if (form.status === FormStatus.COMPLETED) return false;

    const userSignature = form.signatures.find(
      (sig) =>
        sig.userId === userId && sig.signatureType === SignatureType.TECHNICIAN,
    );

    return !userSignature;
  }

  // ========== PREOPERATIONAL CHECKLIST TEMPLATES ==========
  async createPreoperationalChecklistTemplate(
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    const normalizedToolType = dto.toolType.trim().toUpperCase();

    const existing = await this.preopTemplateRepo.findOne({
      where: { toolType: normalizedToolType, isActive: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una plantilla activa para el tipo de herramienta "${normalizedToolType}"`,
      );
    }

    const paramsWithCodes = this.fillMissingParameterCodes(dto.parameters);

    const template = this.preopTemplateRepo.create({
      toolType: normalizedToolType,
      toolCategory: dto.toolCategory,
      estimatedTime: dto.estimatedTime ?? 10,
      additionalInstructions: dto.additionalInstructions,
      requiresTools: dto.requiresTools ?? [],
      isActive: true,
      parameters: paramsWithCodes.map((p) =>
        this.preopParamRepo.create({
          parameterCode: p.parameterCode,
          parameter: p.parameter,
          description: p.description,
          category: p.category,
          required: p.required,
          critical: p.critical,
          displayOrder: p.displayOrder ?? 0,
        }),
      ),
    });

    const saved = await this.preopTemplateRepo.save(template);

    const withParams = await this.preopTemplateRepo.findOne({
      where: { id: saved.id },
      relations: ['parameters'],
      order: {
        parameters: {
          displayOrder: 'ASC',
        },
      } as any,
    });
    this.notificationsGateway.server.emit('preopTemplates.updated', withParams);

    return withParams;
  }

  async updatePreoperationalChecklistTemplate(
    id: number,
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    const template = await this.preopTemplateRepo.findOne({
      where: { id },
      relations: ['parameters'],
    });

    if (!template) {
      throw new NotFoundException('Plantilla preoperacional no encontrada');
    }

    const normalizedToolType = dto.toolType.trim().toUpperCase();
    const paramsWithCodes = this.fillMissingParameterCodes(dto.parameters);

    await this.preopParamRepo.delete({ templateId: template.id });

    template.toolType = normalizedToolType;
    template.toolCategory = dto.toolCategory;
    template.estimatedTime = dto.estimatedTime ?? template.estimatedTime;
    template.additionalInstructions = dto.additionalInstructions;
    template.requiresTools = dto.requiresTools ?? [];
    template.isActive = true;

    template.parameters = paramsWithCodes.map((p, idx) =>
      this.preopParamRepo.create({
        templateId: template.id,
        parameterCode: p.parameterCode,
        parameter: p.parameter,
        description: p.description,
        category: p.category,
        required: p.required,
        critical: p.critical,
        displayOrder: p.displayOrder ?? idx,
      }),
    );

    const saved = await this.preopTemplateRepo.save(template);

    const withParams = await this.preopTemplateRepo.findOne({
      where: { id: saved.id },
      relations: ['parameters'],
      order: {
        parameters: {
          displayOrder: 'ASC',
        },
      } as any,
    });

    return withParams;
  }

  private fillMissingParameterCodes(
    params: CreatePreoperationalChecklistTemplateDto['parameters'],
    digits = 5,
  ): CreatePreoperationalChecklistTemplateDto['parameters'] {
    if (!params || params.length === 0) return [];

    let max = 0;

    for (const p of params) {
      const raw = p.parameterCode?.trim();
      if (raw && /^\d+$/.test(raw)) {
        const n = parseInt(raw, 10);
        if (n > max) max = n;
      }
    }

    let current = max;

    return params.map((p) => {
      const raw = p.parameterCode?.trim();

      if (!raw) {
        current += 1;
        return {
          ...p,
          parameterCode: String(current).padStart(digits, '0'),
        };
      }

      return {
        ...p,
        parameterCode: raw,
      };
    });
  }

  async getPreoperationalChecklistByToolType(rawToolType: string) {
    const toolType = rawToolType?.trim().toUpperCase();
    if (!toolType) {
      throw new BadRequestException('toolType es requerido');
    }

    let template = await this.preopTemplateRepo.findOne({
      where: { toolType, isActive: true },
      relations: ['parameters'],
      order: {
        parameters: {
          displayOrder: 'ASC',
        },
      } as any,
    });

    if (!template) {
      template = await this.preopTemplateRepo.findOne({
        where: { toolType: 'HERRAMIENTA GENERAL', isActive: true },
        relations: ['parameters'],
        order: {
          parameters: {
            displayOrder: 'ASC',
          },
        } as any,
      });
    }

    if (!template) {
      throw new NotFoundException(
        `No se encontró plantilla preoperacional para herramienta "${toolType}" ni plantilla general`,
      );
    }

    return template;
  }

  // ========== RECHAZAR FORMULARIO ==========
  async rejectForm(formId: number, rejectFormDto: RejectFormDto) {
    const form = await this.formRepository.findOne({ where: { id: formId } });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    if (form.status !== FormStatus.PENDING_SST) {
      throw new BadRequestException(
        'Solo se pueden rechazar formularios pendientes de autorización SST',
      );
    }

    form.status = FormStatus.REJECTED;
    form.rejectionReason = rejectFormDto.reason || undefined;
    form.rejectedByUserId = rejectFormDto.userId;
    form.rejectedByUserName = rejectFormDto.userName;
    form.rejectedAt = new Date();

    await this.formRepository.save(form);

    this.notificationsGateway.server.emit('forms.updated', form);

    return {
      message: 'Formulario rechazado exitosamente',
      form,
    };
  }

  // ========== OTP HELPERS ==========
  private hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private mapSignerTypeToSignatureType(signerType: SignerType): SignatureType {
    return signerType === SignerType.TECHNICIAN
      ? SignatureType.TECHNICIAN
      : SignatureType.SST;
  }

  async requestSignOtp(
    formId: number,
    signerType: SignerType,
    userId: number,
  ): Promise<void> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: ['signatures'],
    });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    const signatureType = this.mapSignerTypeToSignatureType(signerType);

    const existingSignature = form.signatures?.find(
      (s) => s.userId === userId && s.signatureType === signatureType,
    );
    if (existingSignature) {
      throw new BadRequestException(
        'Este usuario ya firmó este formulario con ese rol',
      );
    }

    const user = await this.userRepository.findOne({
      where: { usuarioId: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.email) {
      throw new BadRequestException(
        'El usuario no tiene un correo electrónico registrado',
      );
    }

    await this.signOtpRepository.update(
      {
        userId,
        formId,
        signatureType,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { usedAt: new Date() },
    );

    const code = randomInt(100000, 999999).toString();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.OTP_TTL_MINUTES * 60 * 1000,
    );

    const otp = this.signOtpRepository.create({
      userId,
      formId,
      signatureType,
      codeHash: this.hashOtp(code),
      channel: 'EMAIL',
      expiresAt,
    });

    await this.signOtpRepository.save(otp);

    await this.mailService.sendSignOtpEmail({
      to: user.email,
      code,
      formId,
      signerType,
      nameuser: user.nombre,
      ttlMinutes: this.OTP_TTL_MINUTES,
    });
  }

  private async verifyAndConsumeOtp(
    formId: number,
    signerType: SignerType,
    userId: number,
    code: string,
  ): Promise<void> {
    const signatureType = this.mapSignerTypeToSignatureType(signerType);

    const otp = await this.signOtpRepository.findOne({
      where: {
        userId,
        formId,
        signatureType,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException(
        'No se encontró un código OTP válido para este formulario',
      );
    }

    if (otp.attempts >= this.OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Has superado el número máximo de intentos para este código OTP',
      );
    }

    const providedHash = this.hashOtp(code);

    if (providedHash !== otp.codeHash) {
      otp.attempts += 1;
      await this.signOtpRepository.save(otp);
      throw new BadRequestException('Código OTP inválido');
    }

    otp.usedAt = new Date();
    await this.signOtpRepository.save(otp);
  }

  // ========== PDF GENERATION ==========

  private sanitizeFileName(text: string): string {
    if (!text) return 'UNKNOWN';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toUpperCase();
  }

  private async generateFormPdf(formId: number): Promise<void> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: [
        'atsReport',
        'heightWork',
        'preoperationalChecks',
        'signatures',
        'user',
        'workOrder',
      ],
    });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    const headerImageUrl =
      this.configService.get<string>('PDF_HEADER_IMAGE_URL') || '';

    let templateName: PdfTemplateType;
    let params: Record<string, any>;
    let fileNameBase = '';

    switch (form.formType) {
      case FormType.ATS:
        if (!form.atsReport)
          throw new InternalServerErrorException('Reporte ATS no encontrado');
        templateName = 'ats_report';
        params = buildAtsReportParams(form, { headerImageUrl });

        const atsWorker = this.sanitizeFileName(
          form.atsReport.workerName || 'TRABAJADOR',
        );
        fileNameBase = `ATS_${atsWorker}_${form.atsReport.id}`;
        break;

      case FormType.HEIGHT_WORK:
        if (!form.heightWork)
          throw new InternalServerErrorException(
            'Reporte de Alturas no encontrado',
          );
        templateName = 'height_work_report';
        params = buildHeightWorkReportParams(form, { headerImageUrl });

        const heightWorker = this.sanitizeFileName(
          form.heightWork.workerName || 'TRABAJADOR',
        );
        fileNameBase = `TRABAJO_ALTURAS_${heightWorker}_${form.heightWork.id}`;
        break;

      case FormType.PREOPERATIONAL:
        templateName = 'preoperational_report';
        params = buildPreoperationalReportParams(form, { headerImageUrl });

        const techSignature = form.signatures?.find(
          (s) => s.signatureType === SignatureType.TECHNICIAN,
        );
        const preopWorkerName =
          techSignature?.userName || form.user?.nombre || 'TRABAJADOR';
        const preopWorker = this.sanitizeFileName(preopWorkerName);

        fileNameBase = `PREOPERACIONAL_${preopWorker}_${form.id}`;
        break;

      default:
        throw new InternalServerErrorException(
          `Tipo de formulario no soportado para PDF: ${form.formType}`,
        );
    }

    const pdfBuffer = await this.pdfService.generatePdf({
      templateName,
      params,
    });

    const outDir = path.resolve(process.cwd(), 'generated', 'forms');
    await fs.mkdir(outDir, { recursive: true });

    const fileName = `${fileNameBase}.pdf`;
    const filePath = path.join(outDir, fileName);

    await fs.writeFile(filePath, pdfBuffer);

    const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');

    form.pdfFilePath = filePath;
    form.pdfFileName = fileName;
    form.pdfFileSize = pdfBuffer.length;
    form.pdfHash = pdfHash;
    form.pdfGeneratedAt = new Date();

    await this.formRepository.save(form);
  }

  async getFormPdf(
    formId: number,
  ): Promise<{ buffer: Buffer; fileName: string; fileSize: number }> {
    let form = await this.formRepository.findOne({ where: { id: formId } });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    let fileExists = false;
    if (form.pdfFilePath) {
      try {
        await fs.access(form.pdfFilePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }
    }

    if (!form.pdfFilePath || !fileExists) {
      if (form.status !== FormStatus.COMPLETED) {
        throw new BadRequestException(
          'El PDF solo está disponible cuando el formulario está completado y firmado por SST.',
        );
      }

      await this.generateFormPdf(formId);
      form = await this.formRepository.findOne({ where: { id: formId } });
    }

    if (!form || !form.pdfFilePath) {
      throw new InternalServerErrorException(
        'Error crítico: No se pudo generar o encontrar el PDF.',
      );
    }

    try {
      const buffer = await fs.readFile(form.pdfFilePath);
      const fileName = form.pdfFileName || `form-${form.id}.pdf`;

      return {
        buffer,
        fileName,
        fileSize: buffer.length,
      };
    } catch (error) {
      console.error('Error leyendo archivo PDF:', error);
      throw new InternalServerErrorException(
        'No se pudo leer el archivo PDF del disco.',
      );
    }
  }
}
