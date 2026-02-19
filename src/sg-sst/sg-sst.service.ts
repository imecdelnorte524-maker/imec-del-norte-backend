import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AtsReport } from './entities/ats-report.entity';
import { HeightWork } from './entities/height-work.entity';
import { PreoperationalCheck } from './entities/preoperational-check.entity';
import { Signature, SignatureType } from './entities/signature.entity';
import { GeneratedPdf } from './entities/generated-pdf.entity';
import { CreateAtsDto } from './dto/create-ats.dto';
import { CreateHeightWorkDto } from './dto/create-height-work.dto';
import {
  CreatePreoperationalDto,
  PreoperationalCheckDto,
} from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { CreateAtsWithSignatureDto } from './dto/create-ats-with-signature.dto';
import { CreatePreoperationalWithSignatureDto } from './dto/create-preoperational-with-signature.dto';
import { CreateHeightWorkWithSignatureDto } from './dto/create-height-work-with-signature.dto';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatus } from '../work-orders/enums/work-order-status.enum';
import { PreoperationalChecklistTemplate } from './entities/preoperational-checklist-template.entity';
import { PreoperationalChecklistParameter } from './entities/preoperational-checklist-parameter.entity';
import { CreatePreoperationalChecklistTemplateDto } from './dto/create-preoperational-checklist-template.dto';
import { Form } from './entities/form.entity';
import { FormStatus, FormType } from './enum/check-value.enum';
import { RejectFormDto } from './dto/reject-form.dto';
import { WebsocketGateway } from '../websockets/websocket.gateway';

@Injectable()
export class SgSstService {
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
    @InjectRepository(GeneratedPdf)
    private generatedPdfRepository: Repository<GeneratedPdf>,
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(PreoperationalChecklistTemplate)
    private preopTemplateRepo: Repository<PreoperationalChecklistTemplate>,
    @InjectRepository(PreoperationalChecklistParameter)
    private preopParamRepo: Repository<PreoperationalChecklistParameter>,
    private readonly websocketGateway: WebsocketGateway,
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

      // Verificar si el usuario es uno de los técnicos asignados
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

      if (createAtsDto.signatureData) {
        const signature = this.signatureRepository.create({
          formId: savedForm.id,
          signatureType: SignatureType.TECHNICIAN,
          userId: createAtsDto.userId,
          userName: createAtsDto.workerName,
          signatureData: createAtsDto.signatureData,
        });

        await queryRunner.manager.save(Signature, signature);

        savedForm.technicianSignatureDate = new Date();
        savedForm.status = FormStatus.PENDING_SST;
        await queryRunner.manager.save(Form, savedForm);
      }

      await queryRunner.commitTransaction();

      // 🔴 WebSocket
      this.websocketGateway.emit('forms.created', {
        formType: FormType.ATS,
        form: savedForm,
      });

      return {
        form: savedForm,
        ats: savedAts,
        signatureCreated: !!createAtsDto.signatureData,
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

    // Verificar si el usuario es uno de los técnicos asignados
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

    // 🔴 WebSocket
    this.websocketGateway.emit('forms.created', {
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

    // Verificar si el usuario es uno de los técnicos asignados
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

    // 🔴 WebSocket
    this.websocketGateway.emit('forms.created', {
      formType: FormType.PREOPERATIONAL,
      form: savedForm,
    });

    return { form: savedForm, checks: savedChecks };
  }

  // ========== SIGNATURE METHODS ==========
  async signForm(formId: number, signFormDto: SignFormDto) {
    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    const existingSignature = await this.signatureRepository.findOne({
      where: {
        formId,
        signatureType:
          signFormDto.signerType === SignerType.TECHNICIAN
            ? SignatureType.TECHNICIAN
            : SignatureType.SST,
        userId: signFormDto.userId,
      },
    });

    if (existingSignature) {
      throw new BadRequestException('El usuario ya ha firmado este formulario');
    }

    const signature = this.signatureRepository.create({
      formId,
      signatureType:
        signFormDto.signerType === SignerType.TECHNICIAN
          ? SignatureType.TECHNICIAN
          : SignatureType.SST,
      userId: signFormDto.userId,
      userName: signFormDto.userName,
      signatureData: signFormDto.signatureData,
    });

    await this.signatureRepository.save(signature);

    if (signFormDto.signerType === SignerType.TECHNICIAN) {
      form.technicianSignatureDate = new Date();
      form.status = FormStatus.PENDING_SST;
    } else if (signFormDto.signerType === SignerType.SST) {
      form.sstSignatureDate = new Date();
      form.status = FormStatus.COMPLETED;
    }

    await this.formRepository.save(form);

    // 🔴 WebSocket
    this.websocketGateway.emit('forms.updated', form);

    return { message: 'Firma registrada exitosamente', form };
  }

  // ========== AUTORIZAR TRABAJO EN ALTURAS ==========
  async authorizeHeightWork(formId: number, authorizeDto: any) {
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

      const signature = this.signatureRepository.create({
        formId: formId,
        signatureType: SignatureType.SST,
        userId: authorizeDto.userId,
        userName: authorizeDto.userName,
        signatureData: authorizeDto.signatureData,
      });

      await queryRunner.manager.save(Signature, signature);

      form.status = FormStatus.COMPLETED;
      form.sstSignatureDate = new Date();
      await queryRunner.manager.save(Form, form);

      await queryRunner.commitTransaction();

      // 🔴 WebSocket
      this.websocketGateway.emit('forms.updated', form);

      return {
        form,
        heightWork,
        signature,
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
        'generatedPdfs',
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

  // ========== ATS WITH SIGNATURE ==========
  async createAtsWithSignature(
    createAtsWithSignatureDto: CreateAtsWithSignatureDto,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createAtsWithSignatureDto.workOrderId },
        relations: [
          'cliente',
          'clienteEmpresa',
          'technicians',
          'technicians.technician',
        ],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createAtsWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      // Verificar si el usuario es uno de los técnicos asignados
      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) => tech.tecnicoId === createAtsWithSignatureDto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
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
        userId: createAtsWithSignatureDto.userId,
        createdBy: createAtsWithSignatureDto.createdBy,
        workOrderId: workOrder.ordenId,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      const atsReport = this.atsRepository.create({
        formId: savedForm.id,
        workerName: createAtsWithSignatureDto.workerName,
        workerIdentification: createAtsWithSignatureDto.workerIdentification,
        position: createAtsWithSignatureDto.position,
        clientId,
        clientName,
        clientNit,
        area: createAtsWithSignatureDto.area,
        subArea: createAtsWithSignatureDto.subArea,
        workToPerform: createAtsWithSignatureDto.workToPerform,
        location: createAtsWithSignatureDto.location,
        startTime: createAtsWithSignatureDto.startTime,
        endTime: createAtsWithSignatureDto.endTime,
        date: createAtsWithSignatureDto.date,
        observations: createAtsWithSignatureDto.observations,
        selectedRisks: createAtsWithSignatureDto.selectedRisks,
        requiredPpe: createAtsWithSignatureDto.requiredPpe,
      });
      const savedAts = await queryRunner.manager.save(AtsReport, atsReport);

      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType:
          createAtsWithSignatureDto.signerType === 'TECHNICIAN'
            ? SignatureType.TECHNICIAN
            : SignatureType.SST,
        userId: createAtsWithSignatureDto.userId,
        userName: createAtsWithSignatureDto.userName,
        signatureData: createAtsWithSignatureDto.signatureData,
      });
      await queryRunner.manager.save(Signature, signature);

      if (createAtsWithSignatureDto.signerType === 'TECHNICIAN') {
        savedForm.technicianSignatureDate = new Date();
        savedForm.status = FormStatus.PENDING_SST;
      } else if (createAtsWithSignatureDto.signerType === 'SST') {
        savedForm.sstSignatureDate = new Date();
        savedForm.status = FormStatus.COMPLETED;
      }
      await queryRunner.manager.save(Form, savedForm);

      await queryRunner.commitTransaction();

      this.websocketGateway.emit('forms.created', {
        formType: FormType.ATS,
        form: savedForm,
      });
      return { form: savedForm, ats: savedAts, signature };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========== HEIGHT WORK WITH SIGNATURE ==========
  async createHeightWorkWithSignature(
    createHeightWorkWithSignatureDto: CreateHeightWorkWithSignatureDto,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createHeightWorkWithSignatureDto.workOrderId },
        relations: [
          'cliente',
          'clienteEmpresa',
          'technicians',
          'technicians.technician',
        ],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createHeightWorkWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      // Verificar si el usuario es uno de los técnicos asignados
      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) => tech.tecnicoId === createHeightWorkWithSignatureDto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
        );
      }

      const form = this.formRepository.create({
        formType: FormType.HEIGHT_WORK,
        status: FormStatus.DRAFT,
        userId: createHeightWorkWithSignatureDto.userId,
        createdBy: createHeightWorkWithSignatureDto.createdBy,
        workOrderId: workOrder.ordenId,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      const heightWork = this.heightWorkRepository.create({
        formId: savedForm.id,
        workerName: createHeightWorkWithSignatureDto.workerName,
        identification: createHeightWorkWithSignatureDto.identification,
        position: createHeightWorkWithSignatureDto.position,
        workDescription: createHeightWorkWithSignatureDto.workDescription,
        location: createHeightWorkWithSignatureDto.location,
        estimatedTime: createHeightWorkWithSignatureDto.estimatedTime,
        protectionElements: createHeightWorkWithSignatureDto.protectionElements,
        physicalCondition: createHeightWorkWithSignatureDto.physicalCondition,
        instructionsReceived:
          createHeightWorkWithSignatureDto.instructionsReceived,
        fitForHeightWork: createHeightWorkWithSignatureDto.fitForHeightWork,
        authorizerName: createHeightWorkWithSignatureDto.authorizerName,
        authorizerIdentification:
          createHeightWorkWithSignatureDto.authorizerIdentification,
      });
      const savedHeightWork = await queryRunner.manager.save(
        HeightWork,
        heightWork,
      );

      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType:
          createHeightWorkWithSignatureDto.signerType === 'TECHNICIAN'
            ? SignatureType.TECHNICIAN
            : SignatureType.SST,
        userId: createHeightWorkWithSignatureDto.userId,
        userName: createHeightWorkWithSignatureDto.userName,
        signatureData: createHeightWorkWithSignatureDto.signatureData,
      });
      const savedSignature = await queryRunner.manager.save(
        Signature,
        signature,
      );

      if (createHeightWorkWithSignatureDto.signerType === 'TECHNICIAN') {
        savedForm.technicianSignatureDate = new Date();
        savedForm.status = FormStatus.PENDING_SST;
      } else if (createHeightWorkWithSignatureDto.signerType === 'SST') {
        savedForm.sstSignatureDate = new Date();
        savedForm.status = FormStatus.COMPLETED;
      }
      await queryRunner.manager.save(Form, savedForm);

      await queryRunner.commitTransaction();

      this.websocketGateway.emit('forms.created', {
        formType: FormType.HEIGHT_WORK, // o HEIGHT_WORK / PREOPERATIONAL
        form: savedForm,
      });
      return {
        form: savedForm,
        heightWork: savedHeightWork,
        signature: savedSignature,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========== PREOPERATIONAL WITH SIGNATURE ==========
  async createPreoperationalWithSignature(
    createPreoperationalWithSignatureDto: CreatePreoperationalWithSignatureDto,
  ) {
    const queryRunner =
      this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createPreoperationalWithSignatureDto.workOrderId },
        relations: [
          'cliente',
          'clienteEmpresa',
          'technicians',
          'technicians.technician',
        ],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createPreoperationalWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      // Verificar si el usuario es uno de los técnicos asignados
      const isAssignedTechnician = workOrder.technicians?.some(
        (tech) =>
          tech.tecnicoId === createPreoperationalWithSignatureDto.userId,
      );

      if (workOrder.technicians?.length > 0 && !isAssignedTechnician) {
        throw new BadRequestException(
          'La orden de trabajo no está asignada a este técnico',
        );
      }

      const form = this.formRepository.create({
        formType: FormType.PREOPERATIONAL,
        status: FormStatus.DRAFT,
        equipmentTool: createPreoperationalWithSignatureDto.equipmentTool,
        userId: createPreoperationalWithSignatureDto.userId,
        createdBy: createPreoperationalWithSignatureDto.createdBy,
        workOrderId: workOrder.ordenId,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      const checks = createPreoperationalWithSignatureDto.checks.map(
        (checkDto) =>
          this.preoperationalCheckRepository.create({
            formId: savedForm.id,
            parameter: checkDto.parameter,
            value: checkDto.value,
            observations: checkDto.observations,
          }),
      );
      const savedChecks = await queryRunner.manager.save(
        PreoperationalCheck,
        checks,
      );

      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType:
          createPreoperationalWithSignatureDto.signerType === 'TECHNICIAN'
            ? SignatureType.TECHNICIAN
            : SignatureType.SST,
        userId: createPreoperationalWithSignatureDto.userId,
        userName: createPreoperationalWithSignatureDto.userName,
        signatureData: createPreoperationalWithSignatureDto.signatureData,
      });
      const savedSignature = await queryRunner.manager.save(
        Signature,
        signature,
      );

      if (createPreoperationalWithSignatureDto.signerType === 'TECHNICIAN') {
        savedForm.technicianSignatureDate = new Date();
        savedForm.status = FormStatus.PENDING_SST;
      } else if (createPreoperationalWithSignatureDto.signerType === 'SST') {
        savedForm.sstSignatureDate = new Date();
        savedForm.status = FormStatus.COMPLETED;
      }
      await queryRunner.manager.save(Form, savedForm);

      await queryRunner.commitTransaction();
      this.websocketGateway.emit('forms.created', {
        formType: FormType.PREOPERATIONAL,
        form: savedForm,
      });
      return {
        form: savedForm,
        checks: savedChecks,
        signature: savedSignature,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createPreoperationalChecklistTemplate(
    dto: CreatePreoperationalChecklistTemplateDto,
  ) {
    const normalizedToolType = dto.toolType.trim().toUpperCase();

    // Opcional: evitar duplicados por toolType
    const existing = await this.preopTemplateRepo.findOne({
      where: { toolType: normalizedToolType, isActive: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una plantilla activa para el tipo de herramienta "${normalizedToolType}"`,
      );
    }

    // 👉 Rellenar códigos faltantes
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
    // 🔴 WebSocket
    this.websocketGateway.emit('preopTemplates.updated', withParams);

    return withParams;
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

    // Aquí podrías validar que rejectFormDto.userId tenga rol de SST, si quisieras.
    form.status = FormStatus.REJECTED;
    form.rejectionReason = rejectFormDto.reason || undefined;
    form.rejectedByUserId = rejectFormDto.userId;
    form.rejectedByUserName = rejectFormDto.userName;
    form.rejectedAt = new Date();

    await this.formRepository.save(form);

    // 🔴 WebSocket
    this.websocketGateway.emit('forms.updated', form);

    return {
      message: 'Formulario rechazado exitosamente',
      form,
    };
  }

  private fillMissingParameterCodes(
    params: CreatePreoperationalChecklistTemplateDto['parameters'],
    digits = 5, // 00021 -> 5 dígitos
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

    // 👉 Rellenar códigos faltantes en los parámetros recibidos
    const paramsWithCodes = this.fillMissingParameterCodes(dto.parameters);

    // Opción simple: eliminar todos los parámetros anteriores y recrearlos
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

    // Devolver ordenado
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
}
