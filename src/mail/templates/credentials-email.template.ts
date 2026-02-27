// src/mail/templates/credentials-email.template.ts
export interface CredentialsEmailParams {
  username: string;
  plainPassword: string;
  loginUrl: string;
  nameuser?: string;
}

export function buildCredentialsEmailHtml(
  params: CredentialsEmailParams,
): string {
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
