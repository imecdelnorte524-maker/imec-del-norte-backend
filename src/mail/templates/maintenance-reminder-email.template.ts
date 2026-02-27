// src/mail/templates/maintenance-reminder-email.template.ts
export interface MaintenanceReminderItem {
  equipmentCode: string;
  clientName: string;
  fechaProgramada: Date;
  unidadFrecuencia?: string | null;
  diaDelMes?: number | null;
  notas?: string;
}

export function buildMaintenanceReminderEmailHtml(params: {
  items: MaintenanceReminderItem[];
}): string {
  const { items } = params;
  const currentYear = new Date().getFullYear();

  const rows = items
    .map((item) => {
      const fecha = item.fechaProgramada.toISOString().slice(0, 10);
      const frecuenciaDesc = item.unidadFrecuencia
        ? item.unidadFrecuencia +
          (item.diaDelMes ? ` (día ${item.diaDelMes})` : '')
        : 'No especificada';

      return `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${item.equipmentCode}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${item.clientName}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${fecha}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${frecuenciaDesc}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${item.notas || ''}</td>
          </tr>
        `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Mantenimientos programados</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; border:1px solid #e0e0e0;">
            <tr>
              <td style="background-color:#0067AC; padding:20px 30px; color:#ffffff; font-size:20px; font-weight:bold;">
                Imec del Norte - Mantenimientos programados
              </td>
            </tr>

            <tr>
              <td style="padding:24px 30px; color:#333333; font-size:14px; line-height:1.5;">
                <p style="margin:0 0 15px 0;">
                  Estos son los mantenimientos programados para los próximos días:
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background-color:#f3f4f6;">
                      <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Equipo</th>
                      <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Cliente</th>
                      <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Fecha programada</th>
                      <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Frecuencia</th>
                      <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>

                <p style="margin:15px 0 0 0; font-size:12px; color:#777777;">
                  Este es un correo automático de recordatorio.
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
