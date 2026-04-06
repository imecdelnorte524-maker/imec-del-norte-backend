// src/sg-sst/sg-sst.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash, randomInt } from 'crypto';

import { AtsReport } from './entities/ats-report.entity';
import { HeightWork } from './entities/height-work.entity';
import { PreoperationalCheck } from './entities/preoperational-check.entity';
import { Signature } from './entities/signature.entity';
import { SignOtp } from './entities/sign-otp.entity';
import { Form } from './entities/form.entity';

import { CreateAtsDto } from './dto/create-ats.dto';
import { CreateHeightWorkDto } from './dto/create-height-work.dto';
import { CreatePreoperationalDto } from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { CreatePreoperationalChecklistTemplateDto } from './dto/create-preoperational-checklist-template.dto';
import { RejectFormDto } from './dto/reject-form.dto';

import { WorkOrder } from '../work-orders/entities/work-order.entity';
import {
  WorkOrderStatus,
  FormStatus,
  FormType,
  SignatureType,
  TermsType,
} from '../shared/index';
import { PreoperationalChecklistTemplate } from './entities/preoperational-checklist-template.entity';
import { PreoperationalChecklistParameter } from './entities/preoperational-checklist-parameter.entity';

import { RealtimeService } from '../realtime/realtime.service';
import { ConfigService } from '@nestjs/config';
import { PdfService } from '../pdf/pdf.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { PdfTemplateType } from '../pdf/constants/wkhtmltopdf.config';
import { buildAtsReportParams } from '../../templates/report/ats-report-html.helper';
import { buildHeightWorkReportParams } from '../../templates/report/height-work-report-html.helper';
import { buildPreoperationalReportParams } from '../../templates/report/preoperational-report-html.helper';
import { AuthorizeHeightWorkDto } from './dto/authorize-height-work.dto';

import { AtsRiskCategory } from './entities/ats-risk-category.entity';
import { AtsRisk } from './entities/ats-risk.entity';
import { AtsPpeItem } from './entities/ats-ppe-item.entity';
import { AtsReportRisk } from './entities/ats-report-risk.entity';
import { AtsReportPpeItem } from './entities/ats-report-ppe-item.entity';

import { HeightProtectionElement } from './entities/height-protection-element.entity';
import { HeightWorkProtectionElement } from './entities/height-work-protection-element.entity';

import {
  FormTermsAcceptance,
} from './entities/form-terms-acceptance.entity';

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

    @InjectRepository(AtsRiskCategory)
    private atsRiskCategoryRepo: Repository<AtsRiskCategory>,
    @InjectRepository(AtsRisk)
    private atsRiskRepo: Repository<AtsRisk>,
    @InjectRepository(AtsPpeItem)
    private atsPpeRepo: Repository<AtsPpeItem>,
    @InjectRepository(AtsReportRisk)
    private atsReportRiskRepo: Repository<AtsReportRisk>,
    @InjectRepository(AtsReportPpeItem)
    private atsReportPpeRepo: Repository<AtsReportPpeItem>,

    @InjectRepository(HeightProtectionElement)
    private heightProtRepo: Repository<HeightProtectionElement>,
    @InjectRepository(HeightWorkProtectionElement)
    private heightWorkProtRepo: Repository<HeightWorkProtectionElement>,

    @InjectRepository(FormTermsAcceptance)
    private termsAcceptanceRepo: Repository<FormTermsAcceptance>,

    private readonly realtime: RealtimeService,
    private readonly mailService: MailService,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
  ) { }

  // =========================
  // AUTH / PERMISSIONS
  // =========================
  private async assertIsAdminOrSst(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { usuarioId: userId },
      relations: ['role'],
    });

    const roleName = (user?.role?.nombreRol || '').toUpperCase();
    const ok =
      roleName.includes('ADMIN') ||
      roleName.includes('SGSST') ||
      roleName.includes('SG-SST') ||
      roleName.includes('SST');

    if (!ok) {
      throw new ForbiddenException(
        'No tienes permisos para administrar catálogos',
      );
    }
  }

  private async assertCanEditFormOrThrow(formId: number, currentUserId: number) {
    const form = await this.formRepository.findOne({
      where: { id: formId },
    });
    if (!form) throw new NotFoundException('Formulario no encontrado');

    if (![FormStatus.DRAFT, FormStatus.REJECTED].includes(form.status)) {
      throw new BadRequestException(
        'Solo se pueden editar formularios en estado DRAFT o REJECTED',
      );
    }

    // Validación: el técnico debe estar asignado a la OT (si existe)
    if (form.workOrderId) {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: form.workOrderId },
        relations: ['technicians'],
      });

      if (workOrder?.technicians?.length) {
        const isAssigned = workOrder.technicians.some(
          (t) => t.tecnicoId === currentUserId,
        );
        if (!isAssigned) {
          throw new ForbiddenException(
            'La orden de trabajo no está asignada a este técnico',
          );
        }
      }
    }

    // si existe firma del técnico para esta versión, no se puede editar
    const techSig = await this.signatureRepository.findOne({
      where: {
        formId,
        formVersion: form.version,
        signatureType: SignatureType.TECHNICIAN,
      },
    });

    if (techSig) {
      throw new BadRequestException(
        'No se puede editar un formulario ya firmado por el técnico (versión actual)',
      );
    }

    return form;
  }

  private async bumpFormVersionAndReset(
    queryRunner: any,
    form: Form,
  ): Promise<Form> {
    form.version = (form.version ?? 1) + 1;

    // estado y firmas
    form.status = FormStatus.DRAFT;
    form.technicianSignatureDate = null;
    form.sstSignatureDate = null;

    // rechazo
    form.rejectionReason = null;
    form.rejectedAt = null;
    form.rejectedByUserId = null;
    form.rejectedByUserName = null;

    // pdf
    form.pdfFilePath = null;
    form.pdfFileName = null;
    form.pdfFileSize = null;
    form.pdfHash = null;
    form.pdfGeneratedAt = null;

    return queryRunner.manager.save(Form, form);
  }

  // =========================
  // TERMS ACCEPTANCE
  // =========================
  private async saveTermsAcceptances(params: {
    formId: number;
    formVersion: number;
    acceptedByUserId: number;
    ip?: string;
    userAgent?: string;
    acceptances: { termsType: TermsType; termsVersion: number }[];
  }) {
    const acceptances = params.acceptances || [];

    // idempotencia: si el front guarda 2 veces en la misma versión
    await this.termsAcceptanceRepo.delete({
      formId: params.formId,
      formVersion: params.formVersion,
    });

    const rows = acceptances.map((a) =>
      this.termsAcceptanceRepo.create({
        formId: params.formId,
        formVersion: params.formVersion,
        termsType: a.termsType,
        termsVersion: a.termsVersion,
        acceptedByUserId: params.acceptedByUserId,
        ip: params.ip,
        userAgent: params.userAgent,
      }),
    );

    if (rows.length) {
      await this.termsAcceptanceRepo.save(rows);
    }
  }

  // =========================
  // ATS - CREATE / UPDATE
  // =========================
  async createAts(dto: CreateAtsDto, clientIp?: string, userAgent?: string) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: dto.workOrderId },
        relations: [
          'cliente',
          'clienteEmpresa',
          'technicians',
          'technicians.technician',
        ],
      });
      if (!workOrder)
        throw new NotFoundException(`Orden ${dto.workOrderId} no encontrada`);

      const isAssigned = workOrder.technicians?.some(
        (t) => t.tecnicoId === dto.userId,
      );
      if (workOrder.technicians?.length > 0 && !isAssigned) {
        throw new BadRequestException(
          'La orden no está asignada a este técnico',
        );
      }
      if (workOrder.estado === WorkOrderStatus.CANCELED) {
        throw new BadRequestException(
          'No se puede crear ATS para orden cancelada',
        );
      }

      // validar activos
      const risks = await this.atsRiskRepo.find({
        where: (dto.riskIds || []).map((id) => ({ id, isActive: true })),
      });
      if (risks.length !== (dto.riskIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más riskIds no existen o están inactivos',
        );
      }

      const ppeItems = await this.atsPpeRepo.find({
        where: (dto.ppeItemIds || []).map((id) => ({ id, isActive: true })),
      });
      if (ppeItems.length !== (dto.ppeItemIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más ppeItemIds no existen o están inactivos',
        );
      }

      const empresa = workOrder.clienteEmpresa;
      const persona = workOrder.cliente;

      const clientId = empresa ? empresa.idCliente : undefined;
      const clientName = empresa?.nombre || persona?.nombre || '';
      const clientNit = empresa?.nit || undefined;

      const form = queryRunner.manager.create(Form, {
        formType: FormType.ATS,
        status: FormStatus.DRAFT,
        userId: dto.userId,
        createdBy: dto.createdBy,
        workOrderId: workOrder.ordenId,
        version: 1,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      const ats = queryRunner.manager.create(AtsReport, {
        formId: savedForm.id,
        workerName: dto.workerName,
        workerIdentification: dto.workerIdentification,
        position: dto.position,
        clientId,
        clientName,
        clientNit,
        area: dto.area,
        subArea: dto.subArea,
        workToPerform: dto.workToPerform,
        location: dto.location,
        startTime: dto.startTime,
        endTime: dto.endTime,
        date: dto.date,
        observations: dto.observations,
      });
      const savedAts = await queryRunner.manager.save(AtsReport, ats);

      const pivotRisks = (dto.riskIds || []).map((riskId) =>
        queryRunner.manager.create(AtsReportRisk, {
          atsReportId: savedAts.id,
          riskId,
        }),
      );
      await queryRunner.manager.save(AtsReportRisk, pivotRisks);

      const pivotPpe = (dto.ppeItemIds || []).map((ppeItemId) =>
        queryRunner.manager.create(AtsReportPpeItem, {
          atsReportId: savedAts.id,
          ppeItemId,
        }),
      );
      await queryRunner.manager.save(AtsReportPpeItem, pivotPpe);

      await this.saveTermsAcceptances({
        formId: savedForm.id,
        formVersion: savedForm.version,
        acceptedByUserId: dto.userId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'created', {
        formType: FormType.ATS,
        form: savedForm,
      });

      return { form: savedForm, ats: savedAts };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async updateAts(
    formId: number,
    dto: CreateAtsDto,
    currentUserId: number,
    clientIp?: string,
    userAgent?: string,
  ) {
    const baseForm = await this.assertCanEditFormOrThrow(formId, currentUserId);
    if (baseForm.formType !== FormType.ATS) {
      throw new BadRequestException('Este formulario no es ATS');
    }

    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const form = await queryRunner.manager.findOne(Form, {
        where: { id: formId },
      });
      if (!form) throw new NotFoundException('Formulario no encontrado');

      const updatedForm = await this.bumpFormVersionAndReset(queryRunner, form);

      const ats = await queryRunner.manager.findOne(AtsReport, {
        where: { formId },
      });
      if (!ats) throw new NotFoundException('Reporte ATS no encontrado');

      // validar catálogos activos
      const risks = await this.atsRiskRepo.find({
        where: (dto.riskIds || []).map((id) => ({ id, isActive: true })),
      });
      if (risks.length !== (dto.riskIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más riskIds no existen o están inactivos',
        );
      }

      const ppeItems = await this.atsPpeRepo.find({
        where: (dto.ppeItemIds || []).map((id) => ({ id, isActive: true })),
      });
      if (ppeItems.length !== (dto.ppeItemIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más ppeItemIds no existen o están inactivos',
        );
      }

      ats.workerName = dto.workerName;
      ats.workerIdentification = dto.workerIdentification;
      ats.position = dto.position;
      ats.area = dto.area;
      ats.subArea = dto.subArea;
      ats.workToPerform = dto.workToPerform;
      ats.location = dto.location;
      ats.startTime = dto.startTime;
      ats.endTime = dto.endTime;
      ats.date = dto.date;
      ats.observations = dto.observations;

      await queryRunner.manager.save(AtsReport, ats);

      await queryRunner.manager.delete(AtsReportRisk, { atsReportId: ats.id });
      await queryRunner.manager.delete(AtsReportPpeItem, { atsReportId: ats.id });

      const pivotRisks = (dto.riskIds || []).map((riskId) =>
        queryRunner.manager.create(AtsReportRisk, {
          atsReportId: ats.id,
          riskId,
        }),
      );
      await queryRunner.manager.save(AtsReportRisk, pivotRisks);

      const pivotPpe = (dto.ppeItemIds || []).map((ppeItemId) =>
        queryRunner.manager.create(AtsReportPpeItem, {
          atsReportId: ats.id,
          ppeItemId,
        }),
      );
      await queryRunner.manager.save(AtsReportPpeItem, pivotPpe);

      await this.saveTermsAcceptances({
        formId: updatedForm.id,
        formVersion: updatedForm.version,
        acceptedByUserId: currentUserId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'updated', updatedForm);

      return { form: updatedForm, ats };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // =========================
  // HEIGHT WORK - CREATE / UPDATE
  // =========================
  async createHeightWork(
    dto: CreateHeightWorkDto,
    clientIp?: string,
    userAgent?: string,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: dto.workOrderId },
        relations: ['technicians', 'technicians.technician'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${dto.workOrderId} no encontrada`,
        );
      }

      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) => tech.tecnicoId === dto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
        );
      }

      const elements = await this.heightProtRepo.find({
        where: (dto.protectionElementIds || []).map((id) => ({
          id,
          isActive: true,
        })),
      });
      if (elements.length !== (dto.protectionElementIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más protectionElementIds no existen o están inactivos',
        );
      }

      const form = queryRunner.manager.create(Form, {
        formType: FormType.HEIGHT_WORK,
        status: FormStatus.DRAFT,
        userId: dto.userId,
        createdBy: dto.createdBy,
        workOrderId: workOrder.ordenId,
        version: 1,
      });

      const savedForm = await queryRunner.manager.save(Form, form);

      const heightWork = queryRunner.manager.create(HeightWork, {
        formId: savedForm.id,
        workerName: dto.workerName,
        identification: dto.identification,
        position: dto.position,
        workDescription: dto.workDescription,
        location: dto.location,
        estimatedTime: dto.estimatedTime,
        physicalCondition: dto.physicalCondition,
        instructionsReceived: dto.instructionsReceived,
        fitForHeightWork: dto.fitForHeightWork,
        authorizerName: dto.authorizerName,
        authorizerIdentification: dto.authorizerIdentification,
      });

      const savedHeightWork = await queryRunner.manager.save(
        HeightWork,
        heightWork,
      );

      const pivots = (dto.protectionElementIds || []).map(
        (protectionElementId) =>
          queryRunner.manager.create(HeightWorkProtectionElement, {
            heightWorkId: savedHeightWork.id,
            protectionElementId,
          }),
      );
      await queryRunner.manager.save(HeightWorkProtectionElement, pivots);

      await this.saveTermsAcceptances({
        formId: savedForm.id,
        formVersion: savedForm.version,
        acceptedByUserId: dto.userId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'created', {
        formType: FormType.HEIGHT_WORK,
        form: savedForm,
      });

      return { form: savedForm, heightWork: savedHeightWork };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async updateHeightWork(
    formId: number,
    dto: CreateHeightWorkDto,
    currentUserId: number,
    clientIp?: string,
    userAgent?: string,
  ) {
    const baseForm = await this.assertCanEditFormOrThrow(formId, currentUserId);
    if (baseForm.formType !== FormType.HEIGHT_WORK) {
      throw new BadRequestException('Este formulario no es Trabajo en Alturas');
    }

    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const form = await queryRunner.manager.findOne(Form, {
        where: { id: formId },
      });
      if (!form) throw new NotFoundException('Formulario no encontrado');

      const updatedForm = await this.bumpFormVersionAndReset(queryRunner, form);

      const heightWork = await queryRunner.manager.findOne(HeightWork, {
        where: { formId },
      });
      if (!heightWork)
        throw new NotFoundException('Registro de Alturas no encontrado');

      const elements = await this.heightProtRepo.find({
        where: (dto.protectionElementIds || []).map((id) => ({
          id,
          isActive: true,
        })),
      });
      if (elements.length !== (dto.protectionElementIds?.length || 0)) {
        throw new BadRequestException(
          'Uno o más protectionElementIds no existen o están inactivos',
        );
      }

      heightWork.workerName = dto.workerName;
      heightWork.identification = dto.identification;
      heightWork.position = dto.position;
      heightWork.workDescription = dto.workDescription;
      heightWork.location = dto.location;
      heightWork.estimatedTime = dto.estimatedTime;
      heightWork.physicalCondition = dto.physicalCondition;
      heightWork.instructionsReceived = dto.instructionsReceived;
      heightWork.fitForHeightWork = dto.fitForHeightWork;
      heightWork.authorizerName = dto.authorizerName;
      heightWork.authorizerIdentification = dto.authorizerIdentification;

      const savedHeightWork = await queryRunner.manager.save(
        HeightWork,
        heightWork,
      );

      await queryRunner.manager.delete(HeightWorkProtectionElement, {
        heightWorkId: savedHeightWork.id,
      });

      const pivots = (dto.protectionElementIds || []).map(
        (protectionElementId) =>
          queryRunner.manager.create(HeightWorkProtectionElement, {
            heightWorkId: savedHeightWork.id,
            protectionElementId,
          }),
      );
      await queryRunner.manager.save(HeightWorkProtectionElement, pivots);

      await this.saveTermsAcceptances({
        formId: updatedForm.id,
        formVersion: updatedForm.version,
        acceptedByUserId: currentUserId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'updated', updatedForm);

      return { form: updatedForm, heightWork: savedHeightWork };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // =========================
  // PREOP - CREATE / UPDATE
  // =========================
  async createPreoperational(
    dto: CreatePreoperationalDto,
    clientIp?: string,
    userAgent?: string,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: dto.workOrderId },
        relations: ['technicians', 'technicians.technician'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${dto.workOrderId} no encontrada`,
        );
      }

      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) => tech.tecnicoId === dto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
        );
      }

      const template = await this.preopTemplateRepo.findOne({
        where: { id: dto.templateId },
        relations: ['parameters', 'requiredTools'],
      });

      if (!template) {
        throw new NotFoundException('Plantilla preoperacional no encontrada');
      }
      if (!template.isActive) {
        throw new BadRequestException('La plantilla preoperacional no está activa');
      }

      const paramById = new Map<number, PreoperationalChecklistParameter>();
      for (const p of template.parameters || []) paramById.set(p.id, p);

      for (const c of dto.checks || []) {
        if (!paramById.has(c.parameterId)) {
          throw new BadRequestException(
            `parameterId ${c.parameterId} no pertenece a la plantilla ${template.id}`,
          );
        }
      }

      const form = queryRunner.manager.create(Form, {
        formType: FormType.PREOPERATIONAL,
        status: FormStatus.DRAFT,
        equipmentTool: dto.equipmentTool,
        userId: dto.userId,
        createdBy: dto.createdBy,
        workOrderId: workOrder.ordenId,
        version: 1,
      });

      const savedForm = await queryRunner.manager.save(Form, form);

      const checks = (dto.checks || []).map((c) => {
        const p = paramById.get(c.parameterId)!;

        return queryRunner.manager.create(PreoperationalCheck, {
          formId: savedForm.id,
          templateId: template.id,
          parameterId: p.id,
          parameterSnapshot: p.parameter,
          parameterCodeSnapshot: p.parameterCode,
          categorySnapshot: String(p.category),
          requiredSnapshot: p.required,
          criticalSnapshot: p.critical,
          value: c.value,
          observations: c.observations,
        });
      });

      const savedChecks = await queryRunner.manager.save(
        PreoperationalCheck,
        checks,
      );

      await this.saveTermsAcceptances({
        formId: savedForm.id,
        formVersion: savedForm.version,
        acceptedByUserId: dto.userId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'created', {
        formType: FormType.PREOPERATIONAL,
        form: savedForm,
      });

      return {
        form: savedForm,
        checks: savedChecks,
        templateUsed: { id: template.id, toolType: template.toolType, version: template.version },
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async updatePreoperational(
    formId: number,
    dto: CreatePreoperationalDto,
    currentUserId: number,
    clientIp?: string,
    userAgent?: string,
  ) {
    const baseForm = await this.assertCanEditFormOrThrow(formId, currentUserId);
    if (baseForm.formType !== FormType.PREOPERATIONAL) {
      throw new BadRequestException('Este formulario no es Preoperacional');
    }

    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const form = await queryRunner.manager.findOne(Form, {
        where: { id: formId },
      });
      if (!form) throw new NotFoundException('Formulario no encontrado');

      const updatedForm = await this.bumpFormVersionAndReset(queryRunner, form);

      updatedForm.equipmentTool = dto.equipmentTool;
      await queryRunner.manager.save(Form, updatedForm);

      const template = await this.preopTemplateRepo.findOne({
        where: { id: dto.templateId },
        relations: ['parameters', 'requiredTools'],
      });
      if (!template) throw new NotFoundException('Plantilla preoperacional no encontrada');
      if (!template.isActive) throw new BadRequestException('La plantilla preoperacional no está activa');

      const paramById = new Map<number, PreoperationalChecklistParameter>();
      for (const p of template.parameters || []) paramById.set(p.id, p);

      for (const c of dto.checks || []) {
        if (!paramById.has(c.parameterId)) {
          throw new BadRequestException(
            `parameterId ${c.parameterId} no pertenece a la plantilla ${template.id}`,
          );
        }
      }

      await queryRunner.manager.delete(PreoperationalCheck, { formId });

      const checks = (dto.checks || []).map((c) => {
        const p = paramById.get(c.parameterId)!;

        return queryRunner.manager.create(PreoperationalCheck, {
          formId: updatedForm.id,
          templateId: template.id,
          parameterId: p.id,
          parameterSnapshot: p.parameter,
          parameterCodeSnapshot: p.parameterCode,
          categorySnapshot: String(p.category),
          requiredSnapshot: p.required,
          criticalSnapshot: p.critical,
          value: c.value,
          observations: c.observations,
        });
      });

      const savedChecks = await queryRunner.manager.save(
        PreoperationalCheck,
        checks,
      );

      await this.saveTermsAcceptances({
        formId: updatedForm.id,
        formVersion: updatedForm.version,
        acceptedByUserId: currentUserId,
        ip: clientIp,
        userAgent,
        acceptances: dto.termsAcceptances,
      });

      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'updated', updatedForm);

      return {
        form: updatedForm,
        checks: savedChecks,
        templateUsed: { id: template.id, toolType: template.toolType, version: template.version },
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // =========================
  // SIGNATURES
  // =========================
  async signForm(
    formId: number,
    currentUserId: number,
    clientIp: string,
    userAgent: string,
    signFormDto: SignFormDto,
  ) {
    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('Formulario no encontrado');

    const signatureType = this.mapSignerTypeToSignatureType(
      signFormDto.signerType,
    );

    const existingSignature = await this.signatureRepository.findOne({
      where: {
        formId,
        formVersion: form.version,
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
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const userNameReal = `${user.nombre} ${user.apellido ?? ''}`.trim();

    const signature = this.signatureRepository.create({
      formId,
      formVersion: form.version,
      signatureType,
      userId: currentUserId,
      userName: userNameReal,
      signatureData: signFormDto.signatureData,
      ip: clientIp,
      userAgent,
      method: 'OTP_EMAIL',
      contactSnapshot: user.email ?? '',
    });

    // Si SST firma alturas, setear autorizador si está vacío
    if (
      signFormDto.signerType === SignerType.SST &&
      form.formType === FormType.HEIGHT_WORK
    ) {
      const hw = await this.heightWorkRepository.findOne({ where: { formId } });
      if (hw) {
        if (!hw.authorizerName) hw.authorizerName = userNameReal;
        if (!hw.authorizerIdentification)
          hw.authorizerIdentification = user.cedula ?? '';
        await this.heightWorkRepository.save(hw);
      }
    }

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

    this.realtime.emitEntityUpdate('forms', 'updated', form);

    return { message: 'Firma registrada exitosamente', form };
  }

  // =========================
  // LEGACY: AUTORIZAR ALTURAS
  // =========================
  async authorizeHeightWork(formId: number, authorizeDto: AuthorizeHeightWorkDto) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const form = await queryRunner.manager.findOne(Form, {
        where: { id: formId },
      });
      if (!form) throw new NotFoundException('Formulario no encontrado');

      if (form.formType !== FormType.HEIGHT_WORK) {
        throw new BadRequestException('Este formulario no es un Trabajo en Alturas');
      }

      if (form.status !== FormStatus.PENDING_SST) {
        throw new BadRequestException('Este formulario no está pendiente de autorización SST');
      }

      const existingSstSignature = await this.signatureRepository.findOne({
        where: {
          formId,
          formVersion: form.version,
          signatureType: SignatureType.SST,
        },
      });
      if (existingSstSignature) {
        throw new BadRequestException('Este formulario ya ha sido autorizado por SST');
      }

      const heightWork = await queryRunner.manager.findOne(HeightWork, {
        where: { formId },
      });
      if (!heightWork) {
        throw new NotFoundException('Registro de Trabajo en Alturas no encontrado');
      }

      heightWork.physicalCondition = authorizeDto.physicalCondition;
      heightWork.instructionsReceived = authorizeDto.instructionsReceived;
      heightWork.fitForHeightWork = authorizeDto.fitForHeightWork;
      heightWork.authorizerName = authorizeDto.authorizerName;
      heightWork.authorizerIdentification = authorizeDto.authorizerIdentification;

      await queryRunner.manager.save(HeightWork, heightWork);
      await queryRunner.commitTransaction();

      this.realtime.emitEntityUpdate('forms', 'updated', form);

      return { form, heightWork };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // =========================
  // GETS
  // =========================
  async findAllForms(userId?: number) {
    const where = userId ? { createdBy: userId } : {};
    return this.formRepository.find({
      where,
      relations: [
        'atsReport',
        'atsReport.risks',
        'atsReport.ppeItems',

        'heightWork',
        'heightWork.protectionElements',

        'preoperationalChecks',

        'signatures',
        'termsAcceptances',

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
        'atsReport.risks',
        'atsReport.ppeItems',

        'heightWork',
        'heightWork.protectionElements',

        'preoperationalChecks',

        'signatures',
        'termsAcceptances',

        'user',
        'workOrder',
      ],
    });

    if (!form) throw new NotFoundException('Formulario no encontrado');
    return form;
  }

  async getFormsByStatus(status: FormStatus) {
    return this.formRepository.find({
      where: { status },
      relations: [
        'atsReport',
        'atsReport.risks',
        'atsReport.ppeItems',

        'heightWork',
        'heightWork.protectionElements',

        'preoperationalChecks',

        'signatures',
        'termsAcceptances',

        'user',
        'workOrder',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // =========================
  // UTILS
  // =========================
  async canEditForm(formId: number, userId: number): Promise<boolean> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: ['signatures'],
    });

    if (!form) return false;

    if (![FormStatus.DRAFT, FormStatus.REJECTED].includes(form.status)) {
      return false;
    }

    const userSignature = form.signatures?.find(
      (sig) =>
        sig.userId === userId &&
        sig.signatureType === SignatureType.TECHNICIAN &&
        sig.formVersion === form.version,
    );

    return !userSignature;
  }

  // =========================
  // PREOP TEMPLATES (versionado)
  // =========================
  async createPreoperationalChecklistTemplate(
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    const normalizedToolType = dto.toolType.trim().toUpperCase();

    const existingActive = await this.preopTemplateRepo.findOne({
      where: { toolType: normalizedToolType, isActive: true },
    });

    if (existingActive) {
      throw new BadRequestException(
        `Ya existe una plantilla activa para el tipo de herramienta "${normalizedToolType}"`,
      );
    }

    const last = await this.preopTemplateRepo.findOne({
      where: { toolType: normalizedToolType },
      order: { version: 'DESC' } as any,
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const paramsWithCodes = this.fillMissingParameterCodes(dto.parameters);

    const template = this.preopTemplateRepo.create({
      toolType: normalizedToolType,
      toolCategory: dto.toolCategory.trim().toUpperCase(),
      estimatedTime: dto.estimatedTime ?? 10,
      additionalInstructions: dto.additionalInstructions,
      isActive: true,
      version: nextVersion,
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
      requiredTools: (dto.requiresTools || []).map((name, idx) =>
        ({ name: name.trim(), displayOrder: idx } as any),
      ),
    });

    const saved = await this.preopTemplateRepo.save(template);

    const withRelations = await this.preopTemplateRepo.findOne({
      where: { id: saved.id },
      relations: ['parameters', 'requiredTools'],
      order: { parameters: { displayOrder: 'ASC' } } as any,
    });

    if (!withRelations) {
      throw new InternalServerErrorException(
        'No se pudo cargar la plantilla creada con sus relaciones',
      );
    }

    const out = {
      ...withRelations,
      requiresTools: (withRelations.requiredTools || [])
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((x) => x.name),
    } as any;

    this.realtime.emitEntityUpdate('preopTemplates', 'updated', out);
    return out;
  }

  async updatePreoperationalChecklistTemplate(
    id: number,
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    const oldTemplate = await this.preopTemplateRepo.findOne({
      where: { id },
      relations: ['parameters', 'requiredTools'],
    });

    if (!oldTemplate) {
      throw new NotFoundException('Plantilla preoperacional no encontrada');
    }

    const normalizedToolType = dto.toolType.trim().toUpperCase();
    const paramsWithCodes = this.fillMissingParameterCodes(dto.parameters);

    const last = await this.preopTemplateRepo.findOne({
      where: { toolType: oldTemplate.toolType },
      order: { version: 'DESC' } as any,
    });

    const nextVersion = (last?.version ?? oldTemplate.version ?? 1) + 1;

    oldTemplate.isActive = false;
    await this.preopTemplateRepo.save(oldTemplate);

    const newTemplate = this.preopTemplateRepo.create({
      toolType: normalizedToolType,
      toolCategory: dto.toolCategory.trim().toUpperCase(),
      estimatedTime: dto.estimatedTime ?? oldTemplate.estimatedTime,
      additionalInstructions: dto.additionalInstructions,
      isActive: true,
      version: nextVersion,
      replacedByTemplateId: null,
      parameters: paramsWithCodes.map((p, idx) =>
        this.preopParamRepo.create({
          parameterCode: p.parameterCode,
          parameter: p.parameter,
          description: p.description,
          category: p.category,
          required: p.required,
          critical: p.critical,
          displayOrder: p.displayOrder ?? idx,
        }),
      ),
      requiredTools: (dto.requiresTools || []).map((name, idx) =>
        ({ name: name.trim(), displayOrder: idx } as any),
      ),
    });

    const savedNew = await this.preopTemplateRepo.save(newTemplate);

    oldTemplate.replacedByTemplateId = savedNew.id;
    await this.preopTemplateRepo.save(oldTemplate);

    const withRelations = await this.preopTemplateRepo.findOne({
      where: { id: savedNew.id },
      relations: ['parameters', 'requiredTools'],
      order: { parameters: { displayOrder: 'ASC' } } as any,
    });

    if (!withRelations) {
      throw new InternalServerErrorException(
        'No se pudo cargar la plantilla actualizada con sus relaciones',
      );
    }

    const out = {
      ...withRelations,
      requiresTools: (withRelations.requiredTools || [])
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((x) => x.name),
    } as any;

    this.realtime.emitEntityUpdate('preopTemplates', 'updated', out);
    return out;
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
      relations: ['parameters', 'requiredTools'],
      order: { parameters: { displayOrder: 'ASC' } } as any,
    });

    if (!template) {
      template = await this.preopTemplateRepo.findOne({
        where: { toolType: 'HERRAMIENTA GENERAL', isActive: true },
        relations: ['parameters', 'requiredTools'],
        order: { parameters: { displayOrder: 'ASC' } } as any,
      });
    }

    if (!template) {
      throw new NotFoundException(
        `No se encontró plantilla preoperacional para "${toolType}" ni plantilla general`,
      );
    }

    return {
      ...template,
      requiresTools: (template.requiredTools || [])
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((x) => x.name),
    } as any;
  }

  // =========================
  // RECHAZAR
  // =========================
  async rejectForm(formId: number, rejectFormDto: RejectFormDto) {
    const form = await this.formRepository.findOne({ where: { id: formId } });

    if (!form) throw new NotFoundException('Formulario no encontrado');

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

    this.realtime.emitEntityUpdate('forms', 'updated', form);

    return { message: 'Formulario rechazado exitosamente', form };
  }

  // =========================
  // OTP HELPERS
  // =========================
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

    if (!form) throw new NotFoundException('Formulario no encontrado');

    const signatureType = this.mapSignerTypeToSignatureType(signerType);

    const existingSignature = form.signatures?.find(
      (s) =>
        s.userId === userId &&
        s.signatureType === signatureType &&
        s.formVersion === form.version,
    );
    if (existingSignature) {
      throw new BadRequestException(
        'Este usuario ya firmó este formulario con ese rol (versión actual)',
      );
    }

    const user = await this.userRepository.findOne({
      where: { usuarioId: userId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

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

  // =========================
  // PDF
  // =========================
  private sanitizeFileName(text: string): string {
    if (!text) return 'UNKNOWN';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toUpperCase();
  }

  /**
   * Compatibilidad para tus templates PDF existentes:
   * - buildAtsReportParams probablemente esperaba selectedRisks/requiredPpe como objetos.
   * - buildHeightWorkReportParams probablemente esperaba protectionElements como objeto.
   * Aquí lo reconstruimos desde pivotes (no se persiste).
   */
  private attachComputedFieldsForPdf(form: any) {
    if (form?.atsReport) {
      const selectedRisks: Record<string, string[]> = {};
      for (const rr of form.atsReport.risks || []) {
        const catCode = rr.risk?.category?.code || 'otros';
        selectedRisks[catCode] = selectedRisks[catCode] || [];
        selectedRisks[catCode].push(rr.risk?.name);
      }
      const requiredPpe: Record<string, boolean> = {};
      for (const p of form.atsReport.ppeItems || []) {
        if (p.ppeItem?.name) requiredPpe[p.ppeItem.name] = true;
      }
      form.atsReport.selectedRisks = selectedRisks;
      form.atsReport.requiredPpe = requiredPpe;
    }

    if (form?.heightWork) {
      const protectionElements: Record<string, boolean> = {};
      for (const pe of form.heightWork.protectionElements || []) {
        if (pe.protectionElement?.name) {
          protectionElements[pe.protectionElement.name] = true;
        }
      }
      form.heightWork.protectionElements = protectionElements;
    }
  }

  private async generateFormPdf(formId: number): Promise<void> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: [
        'atsReport',
        'atsReport.risks',
        'atsReport.ppeItems',

        'heightWork',
        'heightWork.protectionElements',

        'preoperationalChecks',
        'signatures',
        'user',
        'workOrder',
      ],
    });

    if (!form) throw new NotFoundException('Formulario no encontrado');

    const headerImageUrl =
      this.configService.get<string>('PDF_HEADER_IMAGE_URL') || '';

    let templateName: PdfTemplateType;
    let params: Record<string, any>;
    let fileNameBase = '';

    this.attachComputedFieldsForPdf(form as any);

    switch (form.formType) {
      case FormType.ATS:
        if (!form.atsReport)
          throw new InternalServerErrorException('Reporte ATS no encontrado');
        templateName = 'ats_report';
        params = buildAtsReportParams(form, { headerImageUrl });
        fileNameBase = `ATS_${this.sanitizeFileName(
          form.atsReport.workerName || 'TRABAJADOR',
        )}_${form.atsReport.id}`;
        break;

      case FormType.HEIGHT_WORK:
        if (!form.heightWork)
          throw new InternalServerErrorException(
            'Reporte de Alturas no encontrado',
          );
        templateName = 'height_work_report';
        params = buildHeightWorkReportParams(form, { headerImageUrl });
        fileNameBase = `TRABAJO_ALTURAS_${this.sanitizeFileName(
          form.heightWork.workerName || 'TRABAJADOR',
        )}_${form.heightWork.id}`;
        break;

      case FormType.PREOPERATIONAL:
        templateName = 'preoperational_report';
        params = buildPreoperationalReportParams(form, { headerImageUrl });
        const techSignature = form.signatures?.find(
          (s) => s.signatureType === SignatureType.TECHNICIAN,
        );
        const preopWorkerName =
          techSignature?.userName || form.user?.nombre || 'TRABAJADOR';
        fileNameBase = `PREOPERACIONAL_${this.sanitizeFileName(
          preopWorkerName,
        )}_${form.id}`;
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

    if (!form) throw new NotFoundException('Formulario no encontrado');

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
      throw new InternalServerErrorException(
        'No se pudo leer el archivo PDF del disco.',
      );
    }
  }

  // =========================
  // CATALOGS
  // =========================
  async getAtsCatalogs() {
    const categories = await this.atsRiskCategoryRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
      relations: ['risks'],
    });

    const ppeItems = await this.atsPpeRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    const riskCategories = (categories || []).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      displayOrder: c.displayOrder,
      risks: (c.risks || [])
        .filter((r) => r.isActive)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          displayOrder: r.displayOrder,
          categoryId: r.categoryId,
        })),
    }));

    return { riskCategories, ppeItems };
  }

  async createAtsRiskCategory(
    currentUserId: number,
    dto: { code: string; name: string; displayOrder?: number },
  ) {
    await this.assertIsAdminOrSst(currentUserId);

    const code = dto.code.trim().toLowerCase();
    const name = dto.name.trim();

    const entity = this.atsRiskCategoryRepo.create({
      code,
      name,
      displayOrder: dto.displayOrder ?? 0,
      isActive: true,
    });

    return this.atsRiskCategoryRepo.save(entity);
  }

  async createAtsRisk(
    currentUserId: number,
    dto: {
      categoryId: number;
      name: string;
      description?: string;
      displayOrder?: number;
    },
  ) {
    await this.assertIsAdminOrSst(currentUserId);

    const cat = await this.atsRiskCategoryRepo.findOne({
      where: { id: dto.categoryId },
    });
    if (!cat) throw new NotFoundException('Categoría de riesgo no encontrada');

    const entity = this.atsRiskRepo.create({
      categoryId: dto.categoryId,
      name: dto.name.trim(),
      description: dto.description,
      displayOrder: dto.displayOrder ?? 0,
      isActive: true,
    });

    return this.atsRiskRepo.save(entity);
  }

  async createAtsPpeItem(
    currentUserId: number,
    dto: { name: string; type?: string; displayOrder?: number },
  ) {
    await this.assertIsAdminOrSst(currentUserId);

    const entity = this.atsPpeRepo.create({
      name: dto.name.trim().toUpperCase(),
      type: (dto.type as any) || undefined,
      displayOrder: dto.displayOrder ?? 0,
      isActive: true,
    });

    return this.atsPpeRepo.save(entity);
  }

  async getHeightsCatalogs() {
    const protectionElements = await this.heightProtRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    return { protectionElements };
  }

  async createHeightProtectionElement(
    currentUserId: number,
    dto: { name: string; displayOrder?: number },
  ) {
    await this.assertIsAdminOrSst(currentUserId);

    const entity = this.heightProtRepo.create({
      name: dto.name.trim(),
      displayOrder: dto.displayOrder ?? 0,
      isActive: true,
    });

    return this.heightProtRepo.save(entity);
  }
}