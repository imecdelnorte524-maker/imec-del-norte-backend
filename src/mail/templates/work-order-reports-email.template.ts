// src/mail/templates/work-order-reports-email.template.ts

export type WorkOrderReportType = 'internal' | 'client';

export interface WorkOrderReportsEmailTemplateParams {
  orderIds: number[];
  reportType: WorkOrderReportType;
  recipientName?: string;
  customMessage?: string;
}

export function buildWorkOrderReportsEmailHtml(
  params: WorkOrderReportsEmailTemplateParams,
): string {
  const { orderIds, reportType, recipientName, customMessage } = params;
  const currentYear = new Date().getFullYear();
  const safeName = recipientName || 'usuario';

  const tipoInformeTexto =
    reportType === 'internal'
      ? 'internos de órdenes de servicio'
      : 'para cliente de órdenes de servicio';

  const ordenesListHtml = orderIds
    .map(
      (id) =>
        `<li style="margin-bottom:4px;">Orden de servicio <strong>#${id}</strong></li>`,
    )
    .join('');

  const mensajeExtra = customMessage
    ? `<p style="margin:0 0 15px 0;">${customMessage}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Informes de órdenes de servicio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; border:1px solid #e0e0e0;">
            <tr>
              <td style="background-color:#0067AC; padding:20px 30px; color:#ffffff; font-size:20px; font-weight:bold;">
                Imec del Norte - Informes de órdenes de servicio
              </td>
            </tr>

            <tr>
              <td style="padding:24px 30px; color:#333333; font-size:14px; line-height:1.5;">
                <p style="margin:0 0 15px 0;">Hola, ${safeName}</p>

                <p style="margin:0 0 15px 0;">
                  Te enviamos adjuntos los informes <strong>${tipoInformeTexto}</strong> correspondientes a las siguientes órdenes:
                </p>

                <ul style="margin:0 0 15px 20px; padding:0; color:#374151; font-size:14px;">
                  ${ordenesListHtml}
                </ul>

                ${mensajeExtra}

                <p style="margin:0 0 15px 0; font-size:12px; color:#777777;">
                  Si tienes alguna duda sobre el contenido de los informes, por favor responde a este correo o contacta con nuestro equipo de soporte.
                </p>

                <p style="margin:0; font-size:12px; color:#777777;">
                  Saludos,<br />
                  Equipo de Imec del Norte
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

export function buildWorkOrderReportsEmailText(
  params: WorkOrderReportsEmailTemplateParams,
): string {
  const { orderIds, reportType, recipientName, customMessage } = params;
  const safeName = recipientName || 'usuario';

  const tipoInformeTexto =
    reportType === 'internal'
      ? 'internos de órdenes de servicio'
      : 'para cliente de órdenes de servicio';

  const ordenesTexto = orderIds.map((id) => `- Orden #${id}`).join('\n');

  const mensajeExtra = customMessage ? `\n\n${customMessage}` : '';

  return `
Hola ${safeName},

Te enviamos adjuntos los informes ${tipoInformeTexto} de las siguientes órdenes de servicio:

${ordenesTexto}
${mensajeExtra}

Si tienes alguna duda sobre el contenido de los informes, por favor responde a este correo o contacta con nuestro equipo de soporte.

Saludos,
Equipo de Imec del Norte
  `.trim();
}
