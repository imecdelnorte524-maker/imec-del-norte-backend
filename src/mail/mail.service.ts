// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

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

  // ==========================
  // TEMPLATE: CREDENCIALES
  // ==========================
  private buildCredentialsEmailHtml(params: {
    username: string;
    plainPassword: string;
    loginUrl: string;
    nameuser?: string;
  }): string {
    const { username, plainPassword, loginUrl, nameuser } = params;
    const currentYear = new Date().getFullYear();
    const safeName = nameuser || 'usuario';

    return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Tus credenciales de acceso</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; border:1px solid #e0e0e0;">
            <tr>
              <td style="background-color:#0067AC; padding:20px 30px; color:#ffffff; font-size:20px; font-weight:bold;">
                Imec del Norte - Credenciales de acceso
              </td>
            </tr>

            <tr>
              <td style="padding:24px 30px; color:#333333; font-size:14px; line-height:1.5;">
                <p style="margin:0 0 15px 0;">Hola, ${safeName}</p>

                <p style="margin:0 0 15px 0;">
                  Se ha creado una cuenta para ti en <strong>Imec del Norte Web</strong>.
                </p>

                <p style="margin:0 0 15px 0;">
                  A continuación encontrarás tus credenciales de acceso:
                </p>

                <div style="margin:15px 0; padding:12px 15px; background-color:#f7f7f7; border-radius:6px; border:1px solid #e0e0e0;">
                  <p style="margin:0 0 8px 0;">
                    Usuario: <strong>${username}</strong>
                  </p>
                  <p style="margin:0;">
                    Contraseña temporal: <strong>${plainPassword}</strong>
                  </p>
                </div>

                <p style="margin:15px 0;">
                  Por seguridad, te recomendamos iniciar sesión y cambiar tu contraseña lo antes posible.
                </p>

                <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td align="center" bgcolor="#0067AC" style="border-radius:4px;">
                      <a href="${loginUrl}"
                        style="display:inline-block; padding:10px 22px; font-size:14px; color:#ffffff; text-decoration:none; font-weight:600;">
                        Iniciar sesión
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0; font-size:12px; color:#777777;">
                  Si no esperabas este correo, puedes ignorarlo. Es posible que alguien haya introducido tu dirección por error.
                </p>

                <p style="margin:0; font-size:12px; color:#777777;">
                  Saludos,<br />
                  El Equipo de Soporte
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:15px 30px; background-color:#fafafa; color:#999999; font-size:11px; text-align:center;">
                © ${currentYear} Imec del Norte. Todos los derechos reservados.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  async sendCredentialsEmail(params: {
    to: string;
    username: string;
    plainPassword: string;
    nameuser?: string;
  }): Promise<void> {
    const { to, username, plainPassword, nameuser } = params;

    const loginUrl =
      this.configService.get<string>('APP_LOGIN_URL') ||
      'https://x/';

    const html = this.buildCredentialsEmailHtml({
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

    const mailOptions: nodemailer.SendMailOptions = {
      from:
        this.configService.get<string>('MAIL_FROM') ||
        'no-reply@imecdelnorte.com',
      to,
      subject: 'Tus credenciales de acceso',
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Correo de credenciales enviado a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error enviando correo a ${to}: ${(error as any).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  // ==========================
  // TEMPLATE: RESET PASSWORD
  // ==========================

  private buildPasswordResetEmailHtml(params: {
    resetUrl: string;
    nameuser?: string;
  }): string {
    const { resetUrl, nameuser } = params;
    const currentYear = new Date().getFullYear();
    const safeName = nameuser || 'usuario';

    return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Recuperación de contraseña</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; border:1px solid #e0e0e0;">
            <tr>
              <td style="background-color:#0067AC; padding:20px 30px; color:#ffffff; font-size:20px; font-weight:bold;">
                Imec del Norte - Recuperación de contraseña
              </td>
            </tr>

            <tr>
              <td style="padding:24px 30px; color:#333333; font-size:14px; line-height:1.5;">
                <p style="margin:0 0 15px 0;">Hola, ${safeName}</p>

                <p style="margin:0 0 15px 0;">
                  Hemos recibido una solicitud para restablecer tu contraseña
                  en <strong>Imec del Norte Web</strong>.
                </p>

                <p style="margin:0 0 15px 0;">
                  Si fuiste tú, haz clic en el siguiente botón para crear una nueva contraseña.
                  Este enlace es válido por <strong>1 hora</strong>.
                </p>

                <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td align="center" bgcolor="#0067AC" style="border-radius:4px;">
                      <a href="${resetUrl}"
                        style="display:inline-block; padding:10px 22px; font-size:14px; color:#ffffff; text-decoration:none; font-weight:600;">
                        Restablecer contraseña
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0; font-size:12px; color:#777777;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>

                <p style="margin:0 0 15px 0; font-size:12px; color:#2563eb; word-break:break-all;">
                  <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
                </p>

                <p style="margin:0 0 10px 0; font-size:12px; color:#777777;">
                  Si no solicitaste este cambio, puedes ignorar este correo.
                  Tu contraseña actual seguirá siendo válida.
                </p>

                <p style="margin:0; font-size:12px; color:#777777;">
                  Saludos,<br />
                  El equipo de Soporte de Imec del Norte
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:15px 30px; background-color:#fafafa; color:#999999; font-size:11px; text-align:center;">
                © ${currentYear} Imec del Norte. Todos los derechos reservados.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  async sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    nameuser?: string;
  }): Promise<void> {
    const { to, resetUrl, nameuser } = params;

    const html = this.buildPasswordResetEmailHtml({ resetUrl, nameuser });

    const text = `
Hola${nameuser ? ` ${nameuser}` : ''},

Hemos recibido una solicitud para restablecer tu contraseña en Imec del Norte Web.

Si fuiste tú, abre el siguiente enlace para crear una nueva contraseña (válido por 1 hora):
${resetUrl}

Si no solicitaste este cambio, puedes ignorar este correo.

Saludos,
El equipo de Soporte de Imec del Norte
    `.trim();

    const mailOptions: nodemailer.SendMailOptions = {
      from:
        this.configService.get<string>('MAIL_FROM') ||
        'no-reply@imecdelnorte.com',
      to,
      subject: 'Recuperación de contraseña',
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Correo de recuperación enviado a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error enviando correo de recuperación a ${to}: ${
          (error as any).message
        }`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}