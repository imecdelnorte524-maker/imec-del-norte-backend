import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form, FormType, FormStatus } from './entities/form.entity';
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
import PDFDocument from 'pdfkit';

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
        relations: ['cliente', 'clienteEmpresa', 'tecnico'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createAtsDto.workOrderId} no encontrada`,
        );
      }

      if (workOrder.tecnicoId && workOrder.tecnicoId !== createAtsDto.userId) {
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
      relations: ['tecnico'],
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${createHeightWorkDto.workOrderId} no encontrada`,
      );
    }

    if (
      workOrder.tecnicoId &&
      workOrder.tecnicoId !== createHeightWorkDto.userId
    ) {
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
    return { form: savedForm, heightWork: savedHeightWork };
  }

  // ========== PREOPERATIONAL METHODS ==========
  async createPreoperational(createPreoperationalDto: CreatePreoperationalDto) {
    const workOrder = await this.workOrderRepository.findOne({
      where: { ordenId: createPreoperationalDto.workOrderId },
      relations: ['tecnico'],
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${createPreoperationalDto.workOrderId} no encontrada`,
      );
    }

    if (
      workOrder.tecnicoId &&
      workOrder.tecnicoId !== createPreoperationalDto.userId
    ) {
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

      await this.generatePdf(formId);
    }

    await this.formRepository.save(form);
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

      let pdf: GeneratedPdf | null = null;
      try {
        pdf = await this.generatePdf(formId);
      } catch (error) {
        console.warn('No se pudo generar PDF:', (error as any).message);
      }

      await queryRunner.commitTransaction();

      return {
        form,
        heightWork,
        signature,
        pdf,
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
        relations: ['cliente', 'clienteEmpresa', 'tecnico'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createAtsWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      if (
        workOrder.tecnicoId &&
        workOrder.tecnicoId !== createAtsWithSignatureDto.userId
      ) {
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
        relations: ['tecnico'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createHeightWorkWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      if (
        workOrder.tecnicoId &&
        workOrder.tecnicoId !== createHeightWorkWithSignatureDto.userId
      ) {
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
        relations: ['tecnico'],
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createPreoperationalWithSignatureDto.workOrderId} no encontrada`,
        );
      }

      if (
        workOrder.tecnicoId &&
        workOrder.tecnicoId !== createPreoperationalWithSignatureDto.userId
      ) {
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

  // ========== PDF GENERATION (HTML + templates) ==========
  async generatePdf(formId: number) {
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

    const doc = new PDFDocument({
      margin: 20,
      size: 'letter',
      layout: 'portrait',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfBufferPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Plantilla por tipo basada en los formularios físicos
    switch (form.formType) {
      case FormType.ATS:
        await this.buildAtsPdfTemplate(doc, form);
        break;
      case FormType.HEIGHT_WORK:
        await this.buildHeightWorkPdfTemplate(doc, form);
        break;
      case FormType.PREOPERATIONAL:
        await this.buildPreoperationalPdfTemplate(doc, form);
        break;
      default:
        doc.text('Tipo de formulario no soportado aún.');
    }

    doc.end();
    const pdfBuffer = await pdfBufferPromise;

    const fileName = `formulario_${form.formType}_${formId}_${new Date().toISOString().split('T')[0]}.pdf`;

    const generatedPdf = this.generatedPdfRepository.create({
      formId,
      pdfData: pdfBuffer,
      fileName,
      fileSize: pdfBuffer.length,
      generatedAt: new Date(),
    });

    await this.generatedPdfRepository.save(generatedPdf);
    return generatedPdf;
  }

  private async buildAtsPdfTemplate(doc: any, form: Form) {
    const ats = form.atsReport;
    if (!ats) {
      doc.text('No se encontró el ATS asociado.');
      return;
    }

    // Encabezado
    doc.fontSize(10);
    doc.text('CODIGO: IMEC-SGSST-F-01', { align: 'right' });
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-CO')}`, {
      align: 'right',
    });
    doc.text('VERSION: 01', { align: 'right' });
    doc.text('Página: 1 de 1', { align: 'right' });
    doc.moveDown(2);

    // Título
    doc
      .fontSize(16)
      .text('ANÁLISIS DE TRABAJO SEGURO (ATS)', {
        align: 'center',
        underline: true,
      });
    doc.moveDown();

    // COMPLETE LOS SIGUIENTES DATOS
    doc.fontSize(12).text('COMPLETE LOS SIGUIENTES DATOS', { underline: true });
    doc.moveDown();

    // Tabla de datos
    const tableData = [
      ['Área:', ats.area || '______________________'],
      [
        'Nombre del centro de Trabajo:',
        ats.location || '______________________',
      ],
      ['Hora Inicio:', ats.startTime || '__________'],
    ];

    let y = doc.y;
    tableData.forEach((row, i) => {
      doc.text(row[0], 50, y);
      doc.text(row[1], 200, y);
      y += 20;
    });

    doc.moveDown(1);

    // Riesgos
    doc.text(
      'Indique con ☑ los riesgos/peligros a los que se encuentra expuesto:',
      { underline: true },
    );
    doc.moveDown(0.5);

    if (ats.selectedRisks) {
      const risks = Object.entries(ats.selectedRisks);
      risks.forEach(([category, items], index) => {
        if (index % 2 === 0 && index > 0) {
          doc.moveDown(0.5);
        }
        const x = index % 2 === 0 ? 50 : 300;
        const currentY = doc.y - (index % 2 === 0 ? 0 : 15);

        doc.text(`☑ ${category}:`, x, currentY);
        if (Array.isArray(items)) {
          items.forEach((item, i) => {
            doc.text(`   ${item}`, x + 20, currentY + (i + 1) * 15);
          });
        }
      });
    }

    doc.moveDown(2);

    // Trabajo a realizar
    doc.text('Trabajo a realizar:', { underline: true });
    doc.moveDown(0.5);
    doc.text(
      ats.workToPerform ||
        '________________________________________________________________',
      {
        width: 500,
        align: 'left',
      },
    );
    doc.moveDown(2);

    // EPP
    doc.text('EQUIPO DE PROTECCIÓN PERSONAL REQUERIDO (EPP)', {
      underline: true,
    });
    doc.moveDown(0.5);
    doc.text('Indique con ☑ los elementos que posee:');
    doc.moveDown(0.5);

    if (ats.requiredPpe) {
      const eppItems = Object.entries(ats.requiredPpe)
        .filter(([_, has]) => has)
        .map(([item]) => item);

      let yPos = doc.y;
      eppItems.forEach((item, i) => {
        const x = i % 2 === 0 ? 50 : 300;
        const rowY = yPos + Math.floor(i / 2) * 20;
        doc.text(`☑ ${item}`, x, rowY);
      });

      doc.y = yPos + Math.ceil(eppItems.length / 2) * 20;
    }

    doc.moveDown(2);

    // ADVERTENCIA
    doc.fontSize(10).text('ADVERTENCIA:', { underline: true });
    doc.text(
      'El incumplimiento de las medidas preventivas propuestas en este formato, podrá originar la suspensión de los trabajos.',
      {
        width: 500,
        align: 'justify',
      },
    );
    doc.moveDown(2);

    // Firmas
    const techSig = form.signatures?.find(
      (s) => s.signatureType === SignatureType.TECHNICIAN,
    );

    // TRABAJADOR
    doc.text('TRABAJADOR', { underline: true });
    doc.moveDown(0.5);

    const tableY = doc.y;
    doc.text('Nombre:', 50, tableY);
    doc.text(ats.workerName || '______________________', 150, tableY);

    doc.text('Cargo:', 50, tableY + 20);
    doc.text(ats.position || '______________________', 150, tableY + 20);

    doc.text('Firma:', 50, tableY + 40);

    // Espacio para firma
    if (techSig?.signatureData) {
      try {
        const base64 = techSig.signatureData.includes(',')
          ? techSig.signatureData.split(',')[1]
          : techSig.signatureData;
        const signatureBuffer = Buffer.from(base64, 'base64');
        doc.image(signatureBuffer, 150, tableY + 35, {
          width: 100,
          height: 40,
        });
      } catch (error) {
        doc.text('______________________', 150, tableY + 40);
      }
    } else {
      doc.text('______________________', 150, tableY + 40);
    }

    doc.moveDown(3);

    // OBSERVACIONES
    doc.text('OBSERVACIONES:', { underline: true });
    doc.moveDown(0.5);
    doc.text(
      ats.observations ||
        '________________________________________________________________',
      {
        width: 500,
      },
    );

    // Pie de página
    doc.fontSize(8);
    doc.text(
      'Calle 5 # SE-04 Popular: Cúcuta - Tel: 5811300  Cel: 150237517 - www.imec@imec.com',
      50,
      doc.page.height - 40,
      { align: 'center' },
    );
  }

  private async buildHeightWorkPdfTemplate(doc: any, form: Form) {
    const hw = form.heightWork;
    if (!hw) {
      doc.text('No se encontró el registro de Trabajo en Alturas.');
      return;
    }

    // Encabezado con código
    doc.fontSize(9);
    doc.text('Código: PDM-F-07', { align: 'right' });
    doc.text('Versión: 01', { align: 'right' });
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, {
      align: 'right',
    });
    doc.text('Página 1 de 1', { align: 'right' });
    doc.moveDown(1);

    // Título
    doc
      .fontSize(14)
      .text('GESTIÓN DOCUMENTAL Y DE MEJORA', { align: 'center' });
    doc
      .fontSize(16)
      .text('PERMISO PARA TRABAJO EN ALTURAS', {
        align: 'center',
        underline: true,
      });
    doc.moveDown(1);

    // Fecha y hora
    doc.fontSize(10);
    doc.text(`Fecha: ${form.createdAt.toLocaleDateString('es-CO')}`, 50, doc.y);
    doc.text(`Hora de Inicio: ${hw.estimatedTime || '8:00 AM'}`, 300, doc.y);
    doc.text(`Hora de Fin: ${hw.estimatedTime || '6:00 PM'}`, 450, doc.y);
    doc.moveDown(1.5);

    // PERMISO CONCEDIDO A
    doc.fontSize(12).text('PERMISO CONCEDIDO A', { underline: true });
    doc.moveDown(0.5);

    // Tabla de información del trabajador
    const startY = doc.y;

    // Encabezados de tabla
    doc.fontSize(10).text('NOMBRE', 50, startY, { underline: true });
    doc.text('CEDULA', 250, startY, { underline: true });
    doc.text('CARGO', 350, startY, { underline: true });
    doc.text('EPS', 450, startY, { underline: true });
    doc.text('AFP', 500, startY, { underline: true });
    doc.text('ARL', 550, startY, { underline: true });

    // Datos del trabajador
    const dataY = startY + 15;
    doc.text(hw.workerName || '______________________', 50, dataY);
    doc.text(hw.identification || '______________________', 250, dataY);
    doc.text(hw.position || '______________________', 350, dataY);
    doc.text('MEDIMAS', 450, dataY); // Ejemplo fijo
    doc.text('PORVENIR', 500, dataY); // Ejemplo fijo
    doc.text('POSITIVA', 550, dataY); // Ejemplo fijo

    doc.y = dataY + 25;

    // DESCRIPCION DEL TRABAJO A REALIZAR
    doc
      .fontSize(12)
      .text('DESCRIPCION DEL TRABAJO A REALIZAR', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        hw.workDescription || 'Mantenimiento equipo de aire acondicionado',
        {
          width: 500,
        },
      );
    doc.moveDown(1);

    // TIEMPO ESTIMADO
    doc
      .fontSize(12)
      .text('TIEMPO ESTIMADO PARA LA REALIZACION DEL TRABAJO', {
        underline: true,
      });
    doc.moveDown(0.5);
    doc.fontSize(10).text(hw.estimatedTime || '24 horas');
    doc.moveDown(1);

    // UBICACIÓN
    doc
      .fontSize(12)
      .text('UBICACIÓN ESPECIFICA DEL PUESTO DE TRABAJO', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        hw.location ||
          'Fachada lateral izquierda Edificio Aeropuerto Camilo Daza',
        {
          width: 500,
        },
      );
    doc.moveDown(1);

    // ELEMENTOS DE PROTECCION PERSONAL
    doc
      .fontSize(12)
      .text('ELEMENTOS DE PROTECCION PERSONAL', { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        'LOS SIGUIENTES ELEMENTOS DE PROTECCIÓN PERSONAL Y SISTEMAS DE PROTECCIÓN, DEBERÁN SER UTILIZADOS POR LOS TRABAJADORES DURANTE LA LABOR (MARQUE CON X)',
        {
          width: 500,
        },
      );
    doc.moveDown(0.5);

    // Lista de EPP con casillas
    const eppItems = [
      { name: 'Casco con Barbuquejo', has: hw.protectionElements?.casco },
      { name: 'Lentes de Seguridad', has: hw.protectionElements?.lentes },
      { name: 'Botas de Seguridad', has: hw.protectionElements?.botas },
      { name: 'Guantes', has: hw.protectionElements?.guantes },
      { name: 'Tapaoídos', has: hw.protectionElements?.tapaoidos },
      { name: 'Arnes', has: hw.protectionElements?.arnes },
      {
        name: 'Eslinga de Posicionamiento',
        has: hw.protectionElements?.eslinga,
      },
      { name: 'Línea de Vida', has: hw.protectionElements?.lineaVida },
      { name: 'Señalización', has: hw.protectionElements?.senalizacion },
      {
        name: 'Equipo de descenso',
        has: hw.protectionElements?.equipoDescenso,
      },
      { name: 'Andamios', has: hw.protectionElements?.andamios },
      {
        name: 'Escalera extendible',
        has: hw.protectionElements?.escaleraExtendible,
      },
      { name: 'Escalera tijera', has: hw.protectionElements?.escaleraTijera },
    ];

    let eppY = doc.y;
    eppItems.forEach((item, i) => {
      const x = i < 6 ? 50 : 300;
      const row = i < 6 ? i : i - 6;
      const y = eppY + row * 20;

      // Dibujar casilla
      doc.rect(x, y, 10, 10).stroke();
      if (item.has) {
        doc.fontSize(12).text('X', x + 2, y - 2);
      }

      // Texto del elemento
      doc.fontSize(10).text(item.name, x + 15, y);
    });

    doc.y = eppY + 6 * 20 + 10;

    // Preguntas de aptitud
    const questions = [
      {
        text: '¿POSEE CONDICIONES FISICAS PARA TRABAJAR EN ALTURAS?',
        value: hw.physicalCondition,
      },
      {
        text: '¿RECIBIO INSTRUCCIONES PARA TRABAJAR EN ALTURAS?',
        value: hw.instructionsReceived,
      },
      {
        text: '¿APTO PARA TRABAJO SEGURO EN ALTURAS?',
        value: hw.fitForHeightWork,
      },
    ];

    questions.forEach((q, i) => {
      doc.fontSize(11).text(q.text, 50, doc.y);

      // Casillas SI/NO
      const siX = 400;
      const noX = 450;
      const y = doc.y;

      // Casilla SI
      doc.rect(siX, y, 10, 10).stroke();
      if (q.value === true) {
        doc.fontSize(12).text('X', siX + 2, y - 2);
      }
      doc.text('SI', siX + 15, y);

      // Casilla NO
      doc.rect(noX, y, 10, 10).stroke();
      if (q.value === false) {
        doc.fontSize(12).text('X', noX + 2, y - 2);
      }
      doc.text('NO', noX + 15, y);

      doc.y += 20;
    });

    doc.moveDown(1);

    // AUTORIZACION DEL TRABAJO
    doc.fontSize(12).text('AUTORIZACION DEL TRABAJO', { underline: true });
    doc.moveDown(0.5);

    const authY = doc.y;
    doc.text('NOMBRE', 50, authY, { underline: true });
    doc.text(hw.authorizerName || 'WILLIAN ENRIQUE ROJAS ORTEGA', 150, authY);

    doc.text('CEDULA', 50, authY + 20, { underline: true });
    doc.text(hw.authorizerIdentification || '88.243.640', 150, authY + 20);

    doc.text('FIRMA', 50, authY + 40, { underline: true });

    // Firma del autorizador
    const sstSig = form.signatures?.find(
      (s) => s.signatureType === SignatureType.SST,
    );
    if (sstSig?.signatureData) {
      try {
        const base64 = sstSig.signatureData.includes(',')
          ? sstSig.signatureData.split(',')[1]
          : sstSig.signatureData;
        const signatureBuffer = Buffer.from(base64, 'base64');
        doc.image(signatureBuffer, 150, authY + 35, { width: 100, height: 40 });
      } catch (error) {
        doc.text('______________________', 150, authY + 40);
      }
    } else {
      doc.text('______________________', 150, authY + 40);
    }
  }

  private async buildPreoperationalPdfTemplate(doc: any, form: Form) {
    const checks = form.preoperationalChecks || [];

    // Primera página - Encabezado
    doc.fontSize(9);
    doc.text('INSPECCION', 50, 40);
    doc.text(
      'FECHA: ' + new Date().toLocaleDateString('es-CO').toUpperCase(),
      200,
      40,
    );
    doc.text('VERSION: 01', 400, 40);
    doc.moveDown(0.5);

    doc.fontSize(14).text('PREOPERACIONAL DE', 200, 60, { align: 'center' });
    doc
      .fontSize(16)
      .text(form.equipmentTool?.toUpperCase() || 'ANDAMIOS', 200, 80, {
        align: 'center',
        underline: true,
      });
    doc.fontSize(10).text('Página 1 de 2', 500, 80, { align: 'right' });

    doc.moveDown(4);

    // Tabla de información del operador
    const tableY = doc.y;

    // Fila de nombres de columnas
    doc.fontSize(9);
    doc.text('Nombre:', 50, tableY);
    doc.text('______________________', 120, tableY);

    doc.text('Cargo:', 300, tableY);
    doc.text('______________________', 350, tableY);

    // Semana de inspección
    doc.text(
      'Semana de inspección: de ______ al ______ de ______ del ______',
      50,
      tableY + 20,
    );

    doc.moveDown(2);

    // Encabezado de la tabla de checklist
    const headerY = doc.y;

    // Columnas
    doc.text('ANDAMIOS', 50, headerY);
    doc.text('N°', 120, headerY);
    doc.text('Parámetro de Verificación', 150, headerY);

    // Encabezados de días (B/M)
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    let dayX = 350;
    days.forEach((day, i) => {
      doc.text(day, dayX + i * 30, headerY - 10, { align: 'center' });
      doc.text('B', dayX + i * 30, headerY, { align: 'center' });
      doc.text('M', dayX + i * 30, headerY + 10, { align: 'center' });
    });

    // Línea horizontal
    doc
      .moveTo(50, headerY + 20)
      .lineTo(dayX + 7 * 30, headerY + 20)
      .stroke();

    doc.y = headerY + 25;

    // Instrucciones
    doc
      .fontSize(8)
      .text(
        'El Operador Firma en cada casilla según corresponda el día de inspección:',
        50,
        doc.y,
      );
    doc.moveDown(0.5);
    doc.text(
      'Nota: Significados de nomenclatura B = Bueno  M = Malo  / = se trazará línea en diagonal sobre los días que no se laboró y se plasmará en observaciones.',
      50,
      doc.y,
      { width: 500 },
    );

    doc.moveDown(1);

    // Lista de ítems del checklist
    const itemsY = doc.y;
    checks.forEach((check, index) => {
      const y = itemsY + index * 25;

      // Número
      doc.text((index + 1).toString(), 120, y);

      // Parámetro
      doc.text(check.parameter || `Parámetro ${index + 1}`, 150, y, {
        width: 180,
      });

      // Casillas B/M para cada día
      let dayX = 350;
      for (let day = 0; day < 7; day++) {
        // Dibujar casilla
        doc.rect(dayX + day * 30 - 5, y - 5, 20, 15).stroke();

        // Marcar según el valor
        if (check.value === 'GOOD') {
          doc.fontSize(10).text('B', dayX + day * 30, y, { align: 'center' });
        } else if (check.value === 'BAD') {
          doc.fontSize(10).text('M', dayX + day * 30, y, { align: 'center' });
        }
      }
    });

    // Si hay más de 10 ítems, crear nueva página
    if (checks.length > 10) {
      doc.addPage();
      doc.fontSize(10).text('Página 2 de 2', 500, 40, { align: 'right' });
      doc.y = 60;

      // Continuar con los ítems restantes
      for (let i = 10; i < checks.length; i++) {
        const check = checks[i];
        const y = doc.y;

        doc.text((i + 1).toString(), 120, y);
        doc.text(check.parameter || `Parámetro ${i + 1}`, 150, y, {
          width: 180,
        });

        let dayX = 350;
        for (let day = 0; day < 7; day++) {
          doc.rect(dayX + day * 30 - 5, y - 5, 20, 15).stroke();

          if (check.value === 'GOOD') {
            doc.text('B', dayX + day * 30, y, { align: 'center' });
          } else if (check.value === 'BAD') {
            doc.text('M', dayX + day * 30, y, { align: 'center' });
          }
        }

        doc.y += 25;
      }
    }

    // Si necesitamos segunda página para observaciones
    if (doc.y > 600 || checks.length <= 10) {
      doc.addPage();
    }

    // Segunda página - Observaciones y Plan de Acción
    doc.fontSize(10);
    doc.text('CODIGO: IMEC-SGSST-INS-03', 50, 40);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-CO')}`, 200, 40);
    doc.text('VERSION: 01', 400, 40);
    doc.text('Página 2 de 2', 500, 40);

    doc.moveDown(2);
    doc
      .fontSize(14)
      .text('INSPECCION PREOPERACIONAL DE ANDAMIOS', {
        align: 'center',
        underline: true,
      });
    doc.moveDown(1);

    // Observaciones
    doc.fontSize(12).text('Observaciones', { underline: true });
    doc.moveDown(0.5);

    const checksWithObservations = checks.filter((c) => c.observations);
    if (checksWithObservations.length > 0) {
      checksWithObservations.forEach((check, i) => {
        doc
          .fontSize(10)
          .text(`${i + 1}. ${check.parameter}: ${check.observations}`, {
            width: 500,
            indent: 10,
          });
        doc.moveDown(0.3);
      });
    } else {
      doc.text(
        '________________________________________________________________',
        {
          width: 500,
        },
      );
    }

    doc.moveDown(1);

    // Plan de Acción
    doc.fontSize(12).text('Plan de Acción:', { underline: true });
    doc.moveDown(0.5);

    // Tabla de plan de acción
    const tableStartY = doc.y;
    const columns = [
      { name: 'Recomendación', x: 50, width: 150 },
      { name: 'Fecha de verificación', x: 210, width: 80 },
      { name: 'Ejecutado Sí', x: 300, width: 50 },
      { name: 'No', x: 360, width: 30 },
      { name: 'Prioridad', x: 400, width: 100 },
      { name: 'Responsable de ejecución', x: 510, width: 100 },
    ];

    // Encabezados
    columns.forEach((col) => {
      doc.fontSize(9).text(col.name, col.x, tableStartY, { width: col.width });
    });

    // Línea bajo encabezados
    doc
      .moveTo(50, tableStartY + 10)
      .lineTo(610, tableStartY + 10)
      .stroke();

    // Filas de la tabla
    const rowHeight = 20;
    for (let i = 0; i < 10; i++) {
      const rowY = tableStartY + 15 + i * rowHeight;

      // Líneas horizontales
      doc.moveTo(50, rowY).lineTo(610, rowY).stroke();

      // Líneas verticales
      columns.forEach((col) => {
        doc
          .moveTo(col.x, rowY - rowHeight)
          .lineTo(col.x, rowY)
          .stroke();
      });

      // Prioridad (Inmediata/Pronta Posterior alternadas)
      if (i % 2 === 0) {
        doc.fontSize(8).text('Inmediata', 420, rowY - 15);
      } else {
        doc.fontSize(8).text('Pronta Posterior', 410, rowY - 15);
      }
    }

    // Última línea horizontal
    doc
      .moveTo(50, tableStartY + 15 + 10 * rowHeight)
      .lineTo(610, tableStartY + 15 + 10 * rowHeight)
      .stroke();

    // Firmas al final
    const signatureY = tableStartY + 15 + 10 * rowHeight + 30;

    doc.text('Firma SG-SST', 100, signatureY);
    doc
      .moveTo(100, signatureY + 15)
      .lineTo(250, signatureY + 15)
      .stroke();

    doc.text('Firma Responsable', 350, signatureY);
    doc
      .moveTo(350, signatureY + 15)
      .lineTo(500, signatureY + 15)
      .stroke();

    // Pie de página
    doc.fontSize(8);
    doc.text(
      'Calle 5 # SE-05 Popular: Cúcuta - Telf: 5951300 Cel: 3103275117',
      50,
      doc.page.height - 30,
      { align: 'center' },
    );
  }
}
