// src/work-orders/report/informe-orden-html.helper.ts
import { WorkOrder } from '../../src/work-orders/entities/work-order.entity';

export interface InformeOrdenOptions {
  headerImageUrl: string;
  forClient: boolean; // true = versión cliente (sin ranking, sin facturación/ubicación)
}

export function buildInformeOrdenParams(
  orden: WorkOrder,
  options: InformeOrdenOptions,
): Record<string, any> {
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: any): string => {
    if (num === null || num === undefined) return '-';
    const value = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(value)) return '-';
    return value.toString();
  };

  const tiempoTotal =
    orden.timers?.reduce((total, timer) => {
      if (timer.endTime) {
        return total + (timer.totalSeconds || 0);
      }
      return total;
    }, 0) || 0;

  const tiempoTotalHoras =
    tiempoTotal > 0 ? (tiempoTotal / 3600).toFixed(1) : '0';

  const tiempoPausas =
    orden.pauses
      ?.reduce((acc, pause) => {
        if (pause.startTime && pause.endTime) {
          const start = new Date(pause.startTime).getTime();
          const end = new Date(pause.endTime).getTime();
          return acc + (end - start) / 3600000;
        }
        return acc;
      }, 0)
      .toFixed(1) || '0';

  const comentariosBloque = orden.comentarios
    ? `<div class="info-box" style="margin-bottom: 15px;">
        <h3>COMENTARIOS</h3>
        <p style="font-size: 11px;">${orden.comentarios}</p>
       </div>`
    : '';

  const facturaLink =
    !options.forClient && orden.facturaPdfUrl
      ? `<p><span class="label">Factura:</span> <a href="${orden.facturaPdfUrl}" class="factura-link" target="_blank">Ver factura</a></p>`
      : '';

  const ubicacionLink =
    !options.forClient && orden.clienteEmpresa?.localizacion
      ? `<p><a href="${orden.clienteEmpresa.localizacion}" target="_blank">Ver en Google Maps</a></p>`
      : options.forClient
        ? ''
        : '<p style="color: #999;">No disponible</p>';

  const tiempoPausasTexto =
    tiempoPausas !== '0'
      ? `<div style="font-size: 12px; color: #666;">(Pausas: ${tiempoPausas} horas)</div>`
      : '';

  const firmaBloque = orden.receivedByName
    ? `<div class="signature-area">
        <div class="info-grid">
          <div class="info-box">
            <h3>RECIBIDO POR</h3>
            <p><span class="label">Nombre:</span> ${orden.receivedByName}</p>
            <p><span class="label">Cargo:</span> ${orden.receivedByPosition || ''}</p>
            <p><span class="label">Fecha:</span> ${formatDate(orden.receivedAt)}</p>
          </div>
          <div class="info-box">
            <h3>FIRMA</h3>
            ${
              orden.receivedBySignatureData
                ? `<img src="${orden.receivedBySignatureData}" class="signature-img" alt="Firma">`
                : '<p style="color: #999; font-style: italic;">Sin firma</p>'
            }
          </div>
        </div>
      </div>`
    : '';

  const formatImageDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const equiposHtml =
    orden.equipmentWorkOrders
      ?.map((ewo) => {
        const equipo = ewo.equipment;
        if (!equipo) return '';

        const inspecciones =
          orden.acInspections?.filter(
            (insp) => insp.equipmentId === equipo.equipmentId,
          ) || [];

        const inspeccionBefore = inspecciones.find((i) => i.phase === 'BEFORE');
        const inspeccionAfter = inspecciones.find((i) => i.phase === 'AFTER');

        const imagenesEquipo =
          orden.images?.filter((img) =>
            img.observation?.includes(`[${equipo.code}]`),
          ) || [];

        const imagenesBefore = imagenesEquipo.filter(
          (img) => img.evidencePhase === 'BEFORE',
        );
        const imagenesDuring = imagenesEquipo.filter(
          (img) => img.evidencePhase === 'DURING',
        );
        const imagenesAfter = imagenesEquipo.filter(
          (img) => img.evidencePhase === 'AFTER',
        );

        const generarImagenesHtml = (
          imagenes: any[],
          titulo: string,
        ): string => {
          if (imagenes.length === 0) return '';

          return `
            <div style="margin-top: 20px; page-break-inside: avoid;">
              <h4 style="color: #003366; border-bottom: 1px solid #003366; padding-bottom: 5px;">📸 ${titulo} (${imagenes.length})</h4>
              <div style="display: flex; flex-wrap: wrap; gap: 25px; justify-content: center; margin-top: 15px;">
                ${imagenes
                  .map(
                    (img) => `
                      <div style="width: 300px; text-align: center; page-break-inside: avoid; margin-bottom: 20px;">
                        <img src="${img.url}" 
                             style="width: 300px; height: 225px; object-fit: cover; 
                                    border: 2px solid #003366; border-radius: 8px; 
                                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);" 
                             alt="Evidencia"
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/300x225?text=Error+al+cargar';" />
                        <p style="font-size: 11px; color: #666; margin-top: 8px; font-weight: bold;">
                          📅 ${formatImageDate(img.created_at)}
                        </p>
                        ${
                          img.observation
                            ? `<p style="font-size: 10px; color: #333; font-style: italic; background: #f5f5f5; padding: 5px; border-radius: 4px;">${img.observation}</p>`
                            : ''
                        }
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `;
        };

        const beforeHtml = inspeccionBefore
          ? `
  <div class="inspection-box before">
    <div class="inspection-header">
      <div class="inspection-title">🔴PARÁMETROS ANTES DEL MANTENIMIENTO</div>
      <div class="inspection-chip before">Lecturas iniciales</div>
    </div>

    <table class="inspection-metrics">
      <tr class="inspection-section-row">
        <th colspan="2">Evaporadora </th>
      </tr>
      <tr>
        <th>T° Suministro</th>
        <td>${formatNumber(inspeccionBefore.evapTempSupply)} °C</td>
      </tr>
      <tr>
        <th>T° Retorno</th>
        <td>${formatNumber(inspeccionBefore.evapTempReturn)} °C</td>
      </tr>
      <tr>
        <th>T° Ambiente</th>
        <td>${formatNumber(inspeccionBefore.evapTempAmbient)} °C</td>
      </tr>
      <tr>
        <th>T° Exterior</th>
        <td>${formatNumber(inspeccionBefore.evapTempOutdoor)} °C</td>
      </tr>
      <tr>
        <th>RPM Motor</th>
        <td>${formatNumber(inspeccionBefore.evapMotorRpm)} RPM</td>
      </tr>
      <tr>
        <th>Microfaradios (capacitor)</th>
        <td>${formatNumber(inspeccionBefore.evapMicrofarads)} µF</td>
      </tr>

      <tr class="inspection-section-row">
        <th colspan="2">Condensadora </th>
      </tr>
      <tr>
        <th>Presión Alta</th>
        <td>${formatNumber(inspeccionBefore.condHighPressure)} PSI</td>
      </tr>
      <tr>
        <th>Presión Baja</th>
        <td>${formatNumber(inspeccionBefore.condLowPressure)} PSI</td>
      </tr>
      <tr>
        <th>Amperaje</th>
        <td>${formatNumber(inspeccionBefore.condAmperage)} A</td>
      </tr>
      <tr>
        <th>Voltaje</th>
        <td>${formatNumber(inspeccionBefore.condVoltage)} V</td>
      </tr>
      <tr>
        <th>T° Entrada</th>
        <td>${formatNumber(inspeccionBefore.condTempIn)} °C</td>
      </tr>
      <tr>
        <th>T° Descarga</th>
        <td>${formatNumber(inspeccionBefore.condTempDischarge)} °C</td>
      </tr>
      <tr>
        <th>RPM Motor</th>
        <td>${formatNumber(inspeccionBefore.condMotorRpm)} RMP</td>
      </tr>
      <tr>
        <th>Microfarafios (capacitor)</th>
        <td>${formatNumber(inspeccionBefore.condMicrofarads)} µF</td>
      </tr>
      <tr>
        <th>Ω Ohmio Compresor</th>
        <td>${formatNumber(inspeccionBefore.compressorOhmio)} Ω</td>
      </tr>
    </table>

    ${
      inspeccionBefore.observation
        ? `<p class="inspection-observation before">📝 ${inspeccionBefore.observation}</p>`
        : ''
    }

    ${generarImagenesHtml(imagenesBefore, 'Evidencias ANTES')}
  </div>
`
          : '';

        const afterHtml = inspeccionAfter
          ? `
  <div class="inspection-box after">
    <div class="inspection-header">
      <div class="inspection-title">🟢PARÁMETROS DESPUÉS DEL MANTENIMIENTO</div>
      <div class="inspection-chip after">Lecturas finales</div>
    </div>

    <table class="inspection-metrics">
      <tr class="inspection-section-row">
        <th colspan="2">Evaporadora </th>
      </tr>
      <tr>
        <th>T° Suministro</th>
        <td>${formatNumber(inspeccionAfter.evapTempSupply)} °C</td>
      </tr>
      <tr>
        <th>T° Retorno</th>
        <td>${formatNumber(inspeccionAfter.evapTempReturn)} °C</td>
      </tr>
      <tr>
        <th>T° Ambiente</th>
        <td>${formatNumber(inspeccionAfter.evapTempAmbient)} °C</td>
      </tr>
      <tr>
        <th>T° Exterior</th>
        <td>${formatNumber(inspeccionAfter.evapTempOutdoor)} °C</td>
      </tr>
      <tr>
        <th>RPM Motor</th>
        <td>${formatNumber(inspeccionAfter.evapMotorRpm)} RPM</td>
      </tr>

      <tr class="inspection-section-row">
        <th colspan="2">Condensadora </th>
      </tr>
      <tr>
        <th>Presión Alta</th>
        <td>${formatNumber(inspeccionAfter.condHighPressure)} PSI</td>
      </tr>
      <tr>
        <th>Presión Baja</th>
        <td>${formatNumber(inspeccionAfter.condLowPressure)} PSI</td>
      </tr>
      <tr>
        <th>Amperaje</th>
        <td>${formatNumber(inspeccionAfter.condAmperage)} A</td>
      </tr>
      <tr>
        <th>Voltaje</th>
        <td>${formatNumber(inspeccionAfter.condVoltage)} V</td>
      </tr>
      <tr>
        <th>T° Entrada</th>
        <td>${formatNumber(inspeccionAfter.condTempIn)} °C</td>
      </tr>
      <tr>
        <th>T° Descarga</th>
        <td>${formatNumber(inspeccionAfter.condTempDischarge)} °C</td>
      </tr>
      <tr>
        <th>RPM Motor</th>
        <td>${formatNumber(inspeccionAfter.condMotorRpm)} RMP</td>
      </tr>
    </table>

    ${
      inspeccionAfter.observation
        ? `<p class="inspection-observation after">📝 ${inspeccionAfter.observation}</p>`
        : ''
    }
    
    ${generarImagenesHtml(imagenesAfter, 'Evidencias DESPUÉS')}
  </div>
`
          : '';

        const duringHtml =
          imagenesDuring.length > 0
            ? `
              <div class="inspection-box during" style="margin-top: 20px;">
                <h4 style="color: #ffc107; font-size: 16px;">🟡 PARÁMETROS DURANTE EL MANTENIMIENTO</h4>
                ${generarImagenesHtml(imagenesDuring, 'Evidencias DURANTE')}
              </div>
            `
            : '';

        return `
          <div class="equipment-card">
            <div style="background: #003366; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 20px;">🔧 ${equipo.code || 'N/A'}</h2>
              <p style="margin: 5px 0 0 0; font-size: 14px;">
                ${equipo.area?.nombreArea || 'N/A'}${
                  equipo.subArea?.nombreSubArea
                    ? ` - ${equipo.subArea.nombreSubArea}`
                    : ''
                }
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-bottom: 20px;"><strong>Categoría:</strong> ${equipo.category || 'N/A'}</p>
              
              ${beforeHtml}
              ${duringHtml}
              ${afterHtml}
            </div>
          </div>
        `;
      })
      .join('') || '<p>No hay equipos asociados</p>';

  const tecnicosHtml =
    orden.technicians
      ?.map((tech) => {
        const nombre =
          `${tech.technician?.nombre || ''} ${tech.technician?.apellido || ''}`.trim();
        const lider = tech.isLeader
          ? options.forClient
            ? ' Líder'
            : ' ⭐ Líder'
          : '';

        const ratingHtml = options.forClient
          ? ''
          : tech.rating
            ? `Calificación: ${tech.rating}/5.0`
            : 'Sin calificar';

        return `
          <div class="technician-row">
            <div>
              <strong>${nombre}</strong>${lider}
            </div>
            ${options.forClient ? '' : `<div>${ratingHtml}</div>`}
          </div>
        `;
      })
      .join('') ||
    '<p style="font-style: italic;">No hay técnicos asignados</p>';

  const estadoFacturacion = options.forClient
    ? 'N/A'
    : orden.estadoFacturacion || 'N/A';
  const estadoPago = options.forClient ? 'N/A' : orden.estadoPago || 'N/A';

  return {
    HEADER_IMAGE: options.headerImageUrl,
    ORDEN_ID: orden.ordenId,
    CLIENTE_EMPRESA: orden.clienteEmpresa?.nombre || 'N/A',
    CLIENTE_NIT: orden.clienteEmpresa?.nit || 'N/A',
    CLIENTE_NOMBRE: orden.cliente?.nombre || '',
    CLIENTE_APELLIDO: orden.cliente?.apellido || '',
    CLIENTE_EMAIL: orden.cliente?.email || '',
    CLIENTE_TELEFONO: orden.cliente?.telefono || '',
    FECHA_SOLICITUD: formatDate(orden.fechaSolicitud),
    FECHA_INICIO: formatDate(orden.fechaInicio),
    FECHA_FIN: formatDate(orden.fechaFinalizacion),
    ESTADO: orden.estado || 'N/A',
    ESTADO_CLASE:
      orden.estado?.replace(/\s+/g, '').replace(/í/g, 'i') || 'pendiente',
    SERVICIO_NOMBRE: orden.service?.nombreServicio || 'N/A',
    ESTADO_FACTURACION: estadoFacturacion,
    ESTADO_PAGO: estadoPago,
    FACTURA_LINK: facturaLink,
    UBICACION_LINK: ubicacionLink,
    COMENTARIOS_BLOQUE: comentariosBloque,
    TOTAL_EQUIPOS: orden.equipmentWorkOrders?.length || 0,
    EQUIPOS_HTML: equiposHtml,
    TECNICOS_HTML: tecnicosHtml,
    TIEMPO_TOTAL_HORAS: tiempoTotalHoras,
    TIEMPO_PAUSAS_TEXTO: tiempoPausasTexto,
    FIRMA_BLOQUE: firmaBloque,
    FECHA_GENERACION: new Date().toLocaleDateString('es-CO'),
  };
}
