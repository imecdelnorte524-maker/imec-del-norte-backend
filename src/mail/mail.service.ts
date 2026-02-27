// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { buildCredentialsEmailHtml } from './templates/credentials-email.template';
import {
  buildMaintenanceReminderEmailHtml,
  MaintenanceReminderItem,
} from './templates/maintenance-reminder-email.template';
import { buildPasswordResetEmailHtml } from './templates/password-reset-email.template';
import {
  buildWorkOrderReportsEmailHtml,
  buildWorkOrderReportsEmailText,
  WorkOrderReportsEmailTemplateParams,
} from './templates/work-order-reports-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT')) || 587,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    // Verificar conexión SMTP al arrancar
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('❌ Error verificando SMTP', error);
      } else {
        this.logger.log('✅ SMTP listo para enviar correos');
      }
    });
  }

  async sendMail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<void> {
    const { to, subject, text, html, cc, attachments } = options;

    const mailOptions: nodemailer.SendMailOptions = {
      from:
        this.configService.get<string>('MAIL_FROM') ||
        'no-reply@imecdelnorte.com',
      to,
      cc,
      subject,
      text,
      html,
      attachments,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Correo enviado a ${Array.isArray(to) ? to.join(', ') : to}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando correo a ${Array.isArray(to) ? to.join(', ') : to}: ${
          (error as any).message
        }`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async sendCredentialsEmail(params: {
    to: string;
    username: string;
    plainPassword: string;
    nameuser?: string;
  }): Promise<void> {
    const { to, username, plainPassword, nameuser } = params;

    const loginUrl =
      this.configService.get<string>('APP_LOGIN_URL') || 'https://x/';

    const html = buildCredentialsEmailHtml({
      username,
      plainPassword,
      loginUrl,
      nameuser,
    });

    const text = `
Hola${nameuser ? ` ${nameuser}` : ''},

Se ha creado una cuenta para ti en Imec del Norte Web.

Usuario: ${username}
Contraseña temporal: ${plainPassword}

Por favor, inicia sesión y cambia tu contraseña lo antes posible.
Puedes iniciar sesión aquí: ${loginUrl}

Si no esperabas este correo, puedes ignorarlo.

Saludos,
El equipo de Soporte
    `.trim();

    await this.sendMail({
      to,
      subject: 'Tus credenciales de acceso',
      text,
      html,
    });
  }
  async sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    nameuser?: string;
  }): Promise<void> {
    const { to, resetUrl, nameuser } = params;

    const html = buildPasswordResetEmailHtml({ resetUrl, nameuser });

    const text = `
Hola${nameuser ? ` ${nameuser}` : ''},

Hemos recibido una solicitud para restablecer tu contraseña en Imec del Norte Web.

Si fuiste tú, abre el siguiente enlace para crear una nueva contraseña (válido por 1 hora):
${resetUrl}

Si no solicitaste este cambio, puedes ignorar este correo.

Saludos,
El equipo de Soporte de Imec del Norte
    `.trim();

    await this.sendMail({
      to,
      subject: 'Recuperación de contraseña',
      text,
      html,
    });
  }

  async sendMaintenanceReminderEmail(params: {
    to: string[];
    items: MaintenanceReminderItem[];
  }): Promise<void> {
    const { to, items } = params;

    if (!to.length || !items.length) {
      return;
    }

    const html = buildMaintenanceReminderEmailHtml({ items });

    const lines = items.map((item) => {
      const fecha = item.fechaProgramada.toISOString().slice(0, 10);
      const frecuencia = item.unidadFrecuencia
        ? `${item.unidadFrecuencia}${
            item.diaDelMes ? ` (día ${item.diaDelMes})` : ''
          }`
        : 'No especificada';

      return `- Equipo ${item.equipmentCode} (${item.clientName}) – Fecha: ${fecha} – Frecuencia: ${frecuencia}`;
    });

    const text = `
Mantenimientos programados próximos días:

${lines.join('\n')}

Este es un correo automático de recordatorio.
    `.trim();

    await this.sendMail({
      to,
      subject: 'Mantenimientos programados - Recordatorio semanal',
      text,
      html,
    });
  }

  async sendWorkOrderReportsEmail(options: {
    to: string;
    cc?: string[];
    templateParams: WorkOrderReportsEmailTemplateParams;
    attachments: { filename: string; content: Buffer }[];
  }): Promise<void> {
    const { to, cc, templateParams, attachments } = options;

    const subject =
      templateParams.reportType === 'internal'
        ? 'Informes internos de órdenes de servicio'
        : 'Informes de órdenes de servicio para cliente';

    const html = buildWorkOrderReportsEmailHtml(templateParams);
    const text = buildWorkOrderReportsEmailText(templateParams);
    console.log(
      `[MailService] Enviando correo de reportes a ${to} con ${attachments.length} adjunto(s): ${attachments
        .map((a) => a.filename)
        .join(', ')}`,
    );

    await this.sendMail({
      to,
      cc,
      subject,
      text,
      html,
      attachments,
    });
  }
}
