import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
import { CreatePreoperationalDto, PreoperationalCheckDto } from './dto/create-preoperational.dto';
import { SignFormDto, SignerType } from './dto/sign-form.dto';
import { CreateAtsWithSignatureDto } from './dto/create-ats-with-signature.dto';
import { CreatePreoperationalWithSignatureDto } from './dto/create-preoperational-with-signature.dto';
import { CreateHeightWorkWithSignatureDto } from './dto/create-height-work-with-signature.dto';

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
  ) { }

  // ========== ATS METHODS ==========
  async createAts(createAtsDto: CreateAtsDto) {
    const queryRunner = this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear formulario
      const form = this.formRepository.create({
        formType: FormType.ATS,
        status: FormStatus.DRAFT,
        userId: createAtsDto.userId,
        createdBy: createAtsDto.createdBy,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      // 2. Crear ATS report con los nuevos campos
      const atsReport = this.atsRepository.create({
        formId: savedForm.id,
        workerName: createAtsDto.workerName,
        workerIdentification: createAtsDto.workerIdentification,
        position: createAtsDto.position,
        clientId: createAtsDto.clientId,
        clientName: createAtsDto.clientName,
        clientNit: createAtsDto.clientNit,
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

      // 3. Si hay firma, crearla
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
        signatureCreated: !!createAtsDto.signatureData
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
    const form = this.formRepository.create({
      formType: FormType.HEIGHT_WORK,
      status: FormStatus.DRAFT,
      userId: createHeightWorkDto.userId,
      createdBy: createHeightWorkDto.createdBy,
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
    const form = this.formRepository.create({
      formType: FormType.PREOPERATIONAL,
      status: FormStatus.DRAFT,
      equipmentTool: createPreoperationalDto.equipmentTool,
      userId: createPreoperationalDto.userId,
      createdBy: createPreoperationalDto.createdBy,
    });

    const savedForm = await this.formRepository.save(form);

    // Crear checks preoperacionales
    const checks = createPreoperationalDto.checks.map(checkDto =>
      this.preoperationalCheckRepository.create({
        formId: savedForm.id,
        parameter: checkDto.parameter,
        value: checkDto.value,
        observations: checkDto.observations,
      })
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

    // Verificar si ya firmó este tipo de usuario
    const existingSignature = await this.signatureRepository.findOne({
      where: {
        formId,
        signatureType: signFormDto.signerType === SignerType.TECHNICIAN ? SignatureType.TECHNICIAN : SignatureType.SST,
        userId: signFormDto.userId,
      },
    });

    if (existingSignature) {
      throw new BadRequestException('El usuario ya ha firmado este formulario');
    }

    // Crear firma
    const signature = this.signatureRepository.create({
      formId,
      signatureType: signFormDto.signerType === SignerType.TECHNICIAN ? SignatureType.TECHNICIAN : SignatureType.SST,
      userId: signFormDto.userId,
      userName: signFormDto.userName,
      signatureData: signFormDto.signatureData,
    });

    await this.signatureRepository.save(signature);

    // Actualizar fechas de firma en el formulario
    if (signFormDto.signerType === SignerType.TECHNICIAN) {
      form.technicianSignatureDate = new Date();
      form.status = FormStatus.PENDING_SST;
    } else if (signFormDto.signerType === SignerType.SST) {
      form.sstSignatureDate = new Date();
      form.status = FormStatus.COMPLETED;

      // Generar PDF cuando ambas firmas estén completas
      await this.generatePdf(formId);
    }

    await this.formRepository.save(form);
    return { message: 'Firma registrada exitosamente', form };
  }

  // En SgSstService - Agregar después del método signForm
  async authorizeHeightWork(formId: number, authorizeDto: any) {
    const queryRunner = this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar el formulario
      const form = await this.formRepository.findOne({
        where: { id: formId },
        relations: ['heightWork']
      });

      if (!form) {
        throw new NotFoundException('Formulario no encontrado');
      }

      // 2. Verificar que sea un trabajo en alturas
      if (form.formType !== FormType.HEIGHT_WORK) {
        throw new BadRequestException('Este formulario no es un Trabajo en Alturas');
      }

      // 3. Verificar que esté pendiente de autorización SST
      if (form.status !== FormStatus.PENDING_SST) {
        throw new BadRequestException('Este formulario no está pendiente de autorización SST');
      }

      // 4. Verificar que no haya una firma SST existente
      const existingSstSignature = await this.signatureRepository.findOne({
        where: {
          formId: formId,
          signatureType: SignatureType.SST
        }
      });

      if (existingSstSignature) {
        throw new BadRequestException('Este formulario ya ha sido autorizado por SST');
      }

      // 5. Buscar el registro de heightWork
      const heightWork = await this.heightWorkRepository.findOne({
        where: { formId: formId }
      });

      if (!heightWork) {
        throw new NotFoundException('Registro de Trabajo en Alturas no encontrado');
      }

      // 6. Actualizar los campos de autorización en heightWork
      heightWork.physicalCondition = authorizeDto.physicalCondition;
      heightWork.instructionsReceived = authorizeDto.instructionsReceived;
      heightWork.fitForHeightWork = authorizeDto.fitForHeightWork;
      heightWork.authorizerName = authorizeDto.authorizerName;
      heightWork.authorizerIdentification = authorizeDto.authorizerIdentification;

      await queryRunner.manager.save(HeightWork, heightWork);

      // 7. Crear la firma SST
      const signature = this.signatureRepository.create({
        formId: formId,
        signatureType: SignatureType.SST,
        userId: authorizeDto.userId,
        userName: authorizeDto.userName,
        signatureData: authorizeDto.signatureData,
      });

      await queryRunner.manager.save(Signature, signature);

      // 8. Actualizar el estado del formulario
      form.status = FormStatus.COMPLETED;
      form.sstSignatureDate = new Date();
      await queryRunner.manager.save(Form, form);

      // 9. Opcional: Generar PDF
      let pdf: GeneratedPdf | null = null;
      try {
        pdf = await this.generatePdf(formId);
      } catch (error) {
        console.warn('No se pudo generar PDF:', error.message);
      }

      await queryRunner.commitTransaction();

      return {
        form,
        heightWork,
        signature,
        pdf
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========== PDF GENERATION ==========
  async generatePdf(formId: number) {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: ['atsReport', 'heightWork', 'preoperationalChecks', 'signatures']
    });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    // Aquí implementarías la generación real del PDF
    // Por ahora simulamos la creación
    const pdfBuffer = Buffer.from(`PDF Simulation for Form ${formId}`);

    const generatedPdf = this.generatedPdfRepository.create({
      formId,
      pdfData: pdfBuffer,
      fileName: `formulario_${formId}_${new Date().getTime()}.pdf`,
      filePath: `/pdfs/formulario_${formId}.pdf`,
      fileSize: pdfBuffer.length,
    });

    await this.generatedPdfRepository.save(generatedPdf);
    return generatedPdf;
  }

  // ========== GET METHODS ==========
  async findAllForms(userId?: number) {
    const where = userId ? { createdBy: userId } : {};
    return this.formRepository.find({
      where,
      relations: ['atsReport', 'heightWork', 'preoperationalChecks', 'signatures', 'user'],
      order: { createdAt: 'DESC' }
    });
  }

  async findFormById(id: number) {
    const form = await this.formRepository.findOne({
      where: { id },
      relations: ['atsReport', 'heightWork', 'preoperationalChecks', 'signatures', 'generatedPdfs', 'user']
    });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    return form;
  }

  async getFormsByStatus(status: FormStatus) {
    return this.formRepository.find({
      where: { status },
      relations: ['atsReport', 'heightWork', 'preoperationalChecks'],
      order: { createdAt: 'DESC' }
    });
  }

  // ========== UTILITY METHODS ==========
  async canEditForm(formId: number, userId: number): Promise<boolean> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: ['signatures']
    });

    if (!form) return false;

    // Si ya está completado, no se puede editar
    if (form.status === FormStatus.COMPLETED) return false;

    // Si el usuario ya firmó como técnico, no puede editar
    const userSignature = form.signatures.find(sig =>
      sig.userId === userId && sig.signatureType === SignatureType.TECHNICIAN
    );

    return !userSignature;
  }

  async createAtsWithSignature(createAtsWithSignatureDto: CreateAtsWithSignatureDto) {
    const queryRunner = this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear formulario
      const form = this.formRepository.create({
        formType: FormType.ATS,
        status: FormStatus.DRAFT,
        userId: createAtsWithSignatureDto.userId,
        createdBy: createAtsWithSignatureDto.createdBy,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      // 2. Crear ATS report con los nuevos campos
      const atsReport = this.atsRepository.create({
        formId: savedForm.id,
        workerName: createAtsWithSignatureDto.workerName,
        workerIdentification: createAtsWithSignatureDto.workerIdentification,
        position: createAtsWithSignatureDto.position,
        clientId: createAtsWithSignatureDto.clientId,
        clientName: createAtsWithSignatureDto.clientName,
        clientNit: createAtsWithSignatureDto.clientNit,
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

      // 3. Crear firma
      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType: createAtsWithSignatureDto.signerType === 'TECHNICIAN'
          ? SignatureType.TECHNICIAN
          : SignatureType.SST,
        userId: createAtsWithSignatureDto.userId,
        userName: createAtsWithSignatureDto.userName,
        signatureData: createAtsWithSignatureDto.signatureData,
      });
      await queryRunner.manager.save(Signature, signature);

      // 4. Actualizar estado del formulario
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

  // Para HeightWork
  async createHeightWorkWithSignature(createHeightWorkWithSignatureDto: CreateHeightWorkWithSignatureDto) {
    const queryRunner = this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear formulario
      const form = this.formRepository.create({
        formType: FormType.HEIGHT_WORK,
        status: FormStatus.DRAFT,
        userId: createHeightWorkWithSignatureDto.userId,
        createdBy: createHeightWorkWithSignatureDto.createdBy,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      // 2. Crear HeightWork
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
        instructionsReceived: createHeightWorkWithSignatureDto.instructionsReceived,
        fitForHeightWork: createHeightWorkWithSignatureDto.fitForHeightWork,
        authorizerName: createHeightWorkWithSignatureDto.authorizerName,
        authorizerIdentification: createHeightWorkWithSignatureDto.authorizerIdentification,
      });
      const savedHeightWork = await queryRunner.manager.save(HeightWork, heightWork);

      // 3. Crear firma en tabla signatures
      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType: createHeightWorkWithSignatureDto.signerType === 'TECHNICIAN'
          ? SignatureType.TECHNICIAN
          : SignatureType.SST,
        userId: createHeightWorkWithSignatureDto.userId,
        userName: createHeightWorkWithSignatureDto.userName,
        signatureData: createHeightWorkWithSignatureDto.signatureData,
      });
      const savedSignature = await queryRunner.manager.save(Signature, signature);

      // 4. Actualizar estado del formulario
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
        signature: savedSignature
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Para Preoperational
  async createPreoperationalWithSignature(createPreoperationalWithSignatureDto: CreatePreoperationalWithSignatureDto) {
    const queryRunner = this.formRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear formulario
      const form = this.formRepository.create({
        formType: FormType.PREOPERATIONAL,
        status: FormStatus.DRAFT,
        equipmentTool: createPreoperationalWithSignatureDto.equipmentTool,
        userId: createPreoperationalWithSignatureDto.userId,
        createdBy: createPreoperationalWithSignatureDto.createdBy,
      });
      const savedForm = await queryRunner.manager.save(Form, form);

      // 2. Crear checks preoperacionales
      const checks = createPreoperationalWithSignatureDto.checks.map(checkDto =>
        this.preoperationalCheckRepository.create({
          formId: savedForm.id,
          parameter: checkDto.parameter,
          value: checkDto.value,
          observations: checkDto.observations,
        })
      );
      const savedChecks = await queryRunner.manager.save(PreoperationalCheck, checks);

      // 3. Crear firma en tabla signatures
      const signature = this.signatureRepository.create({
        formId: savedForm.id,
        signatureType: createPreoperationalWithSignatureDto.signerType === 'TECHNICIAN'
          ? SignatureType.TECHNICIAN
          : SignatureType.SST,
        userId: createPreoperationalWithSignatureDto.userId,
        userName: createPreoperationalWithSignatureDto.userName,
        signatureData: createPreoperationalWithSignatureDto.signatureData,
      });
      const savedSignature = await queryRunner.manager.save(Signature, signature);

      // 4. Actualizar estado del formulario
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
        signature: savedSignature
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}