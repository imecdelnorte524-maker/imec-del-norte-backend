// src/mail/templates/password-reset-email.template.ts
export interface PasswordResetEmailParams {
  resetUrl: string;
  nameuser?: string;
}

export function buildPasswordResetEmailHtml(
  params: PasswordResetEmailParams,
): string {
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
