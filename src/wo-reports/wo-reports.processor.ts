import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import JSZip from 'jszip';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { SupabaseTempStorageService } from './supabase-temp-storage.service';
import { WoReportsTokenStore } from './wo-reports.token-store';
import { WoReportsWsPublisherService } from './wo-reports.ws-publisher.service';
import { MailService } from '../mail/mail.service';
import { WO_REPORTS_QUEUE, WoReportJobData } from '../shared';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function buildTimePrefixUTC(d: Date) {
  return `reports/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${pad(d.getUTCHours())}/${pad(d.getUTCMinutes())}`;
}

@Processor(WO_REPORTS_QUEUE)
export class WoReportsProcessor extends WorkerHost {
  constructor(
    private readonly woService: WorkOrdersService,
    private readonly storage: SupabaseTempStorageService,
    private readonly tokenStore: WoReportsTokenStore,
    private readonly wsPublisher: WoReportsWsPublisherService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job<WoReportJobData>) {
    switch (job.data.kind) {
      case 'single':
        return this.processSingle(job);
      case 'batch':
        return this.processBatch(job);
      case 'clients':
        return this.processClients(job);
      default:
        throw new Error('Tipo de job no soportado');
    }
  }

  private async processSingle(job: Job<WoReportJobData>) {
    if (job.data.kind !== 'single') return;

    const { userId, ordenId, reportType, action, toEmail, ccEmails } = job.data;

    const fileName =
      reportType === 'internal'
        ? `OT-${ordenId}-interno.pdf`
        : `Informe-Orden-Servicio-${ordenId}-cliente.pdf`;

    try {
      const pdfBuffer =
        reportType === 'internal'
          ? await this.woService.generarInformeOrden(ordenId)
          : await this.woService.generarInformeOrdenCliente(ordenId);

      if (action === 'email') {
        if (!toEmail) throw new Error('toEmail es requerido para action=email');

        await this.mailService.sendWorkOrderReportsEmail({
          to: toEmail,
          cc: ccEmails,
          templateParams: {
            orderIds: [ordenId],
            reportType: reportType === 'internal' ? 'internal' : 'client',
          },
          attachments: [{ filename: fileName, content: pdfBuffer }],
        });

        await this.wsPublisher.publish({
          type: 'sent',
          userId,
          payload: {
            jobId: job.id,
            ordenId,
            reportType,
          },
        });

        return { sent: true };
      }

      const prefix = buildTimePrefixUTC(new Date());
      const objectPath = `${prefix}/u${userId}-o${ordenId}-j${job.id}.pdf`;

      await this.storage.uploadPdf({ path: objectPath, buffer: pdfBuffer });

      const token = await this.tokenStore.createToken({
        objectPath,
        fileName,
        ordenId,
        reportType,
      });

      await this.wsPublisher.publish({
        type: 'ready',
        userId,
        payload: {
          jobId: job.id,
          ordenId,
          reportType,
          token,
          fileName,
        },
      });

      return { token };
    } catch (e: any) {
      await this.wsPublisher.publish({
        type: 'error',
        userId,
        payload: {
          jobId: job.id,
          ordenId,
          reportType,
          message: e?.message ?? 'Error generando/enviando reporte',
        },
      });
      throw e;
    }
  }

  private async processBatch(job: Job<WoReportJobData>) {
    if (job.data.kind !== 'batch') return;

    const { userId, orderIds, reportType, action, toEmail, ccEmails } =
      job.data;

    try {
      const attachments: { filename: string; content: Buffer }[] = [];

      for (const id of orderIds) {
        const buffer =
          reportType === 'internal'
            ? await this.woService.generarInformeOrden(id)
            : await this.woService.generarInformeOrdenCliente(id);

        const filename =
          reportType === 'internal'
            ? `OT-${id}-interno.pdf`
            : `Informe-Orden-Servicio-${id}-cliente.pdf`;

        attachments.push({ filename, content: buffer });
      }

      let finalBuffer: Buffer;
      let fileName: string;

      if (attachments.length === 1) {
        finalBuffer = attachments[0].content;
        fileName = attachments[0].filename;
      } else {
        const zip = new JSZip();
        for (const att of attachments) {
          zip.file(att.filename, att.content);
        }
        finalBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        fileName =
          reportType === 'internal'
            ? 'informes-internos-ordenes.zip'
            : 'informes-cliente-ordenes.zip';
      }

      if (action === 'email') {
        if (!toEmail) throw new Error('toEmail es requerido para action=email');

        await this.mailService.sendWorkOrderReportsEmail({
          to: toEmail,
          cc: ccEmails,
          templateParams: {
            orderIds,
            reportType: reportType === 'internal' ? 'internal' : 'client',
          },
          attachments: [{ filename: fileName, content: finalBuffer }],
        });

        await this.wsPublisher.publish({
          type: 'sent',
          userId,
          payload: {
            jobId: job.id,
            orderIds,
            reportType,
          },
        });

        return { sent: true };
      }

      const prefix = buildTimePrefixUTC(new Date());
      const ext = fileName.endsWith('.zip') ? 'zip' : 'pdf';
      const objectPath = `${prefix}/u${userId}-batch-j${job.id}.${ext}`;

      await this.storage.uploadPdf({
        path: objectPath,
        buffer: finalBuffer,
      });

      const token = await this.tokenStore.createToken({
        objectPath,
        fileName,
        ordenId: orderIds[0],
        reportType,
      });

      await this.wsPublisher.publish({
        type: 'ready',
        userId,
        payload: {
          jobId: job.id,
          orderIds,
          reportType,
          token,
          fileName,
        },
      });

      return { token };
    } catch (e: any) {
      await this.wsPublisher.publish({
        type: 'error',
        userId,
        payload: {
          jobId: job.id,
          orderIds,
          reportType,
          message: e?.message ?? 'Error generando/enviando lote de reportes',
        },
      });
      throw e;
    }
  }

  private async processClients(job: Job<WoReportJobData>) {
    if (job.data.kind !== 'clients') return;

    const { userId, orderIds, message } = job.data;

    try {
      const result = await this.woService.sendReportsToClientsByEmail(
        {
          orderIds,
          message,
        },
        { userId, role: 'Administrador' }, // si quieres luego refinamos esto
      );

      await this.wsPublisher.publish({
        type: 'sent',
        userId,
        payload: {
          jobId: job.id,
          totalClientsNotified: result.totalClientsNotified,
          details: result.details,
          skipped: result.skipped,
        },
      });

      return result;
    } catch (e: any) {
      await this.wsPublisher.publish({
        type: 'error',
        userId,
        payload: {
          jobId: job.id,
          message: e?.message ?? 'Error enviando reportes a clientes',
        },
      });
      throw e;
    }
  }
}
