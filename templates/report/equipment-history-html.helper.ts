// src/equipment/report/equipment-history-html.helper.ts
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Equipment } from '../../src/equipment/entities/equipment.entity';
import { WorkOrder } from '../../src/work-orders/entities/work-order.entity';
import { WorkOrderStatus } from '../../src/shared';

export interface EquipmentHistoryOptions {
  headerImageUrl: string;
}

export function buildEquipmentHistoryParams(
  equipment: Equipment,
  workOrders: WorkOrder[],
  options: EquipmentHistoryOptions,
): Record<string, any> {
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, 'dd/MM/yyyy', { locale: es });
  };

  const formatDateTime = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  // Función para formatear valores numéricos sin signos de interrogación
  const formatValue = (value: any, unit: string = ''): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    const strValue = String(value).trim();
    if (strValue === '') return 'N/A';
    return unit ? `${strValue} ${unit}` : strValue;
  };

  // Filtrar solo órdenes completadas
  const historicalOrders = workOrders
    .filter((wo) => wo.estado === WorkOrderStatus.COMPLETED)
    .sort((a, b) => {
      const dateA = a.fechaFinalizacion || a.fechaSolicitud;
      const dateB = b.fechaFinalizacion || b.fechaSolicitud;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  // Calcular estadísticas
  const totalWorkOrders = historicalOrders.length;
  const totalSuppliesUsed = historicalOrders.reduce((acc, order) => {
    const orderSupplies =
      order.supplyDetails?.reduce(
        (sum, detail) => sum + Number(detail.cantidadUsada || 0),
        0,
      ) || 0;
    return acc + orderSupplies;
  }, 0);

  const totalServiceSeconds = historicalOrders.reduce((acc, order) => {
    const orderSeconds =
      order.timers?.reduce(
        (sum, timer) => sum + (timer.totalSeconds || 0),
        0,
      ) || 0;
    return acc + orderSeconds;
  }, 0);

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '0 h';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  // ===== GENERAR HTML DE NOTAS =====
  const notasHtml = equipment.notes
    ? `<div class="note-card"><strong>📝 Observaciones:</strong> ${equipment.notes}</div>`
    : '';

  // ===== GENERAR HTML DE EVAPORADORES =====
  const evaporadoresHtml = () => {
    if (!equipment.evaporators?.length) return '';

    let html = `
      <div class="section-title">
        <span class="section-icon">❄️</span> EVAPORADORES (${equipment.evaporators.length})
      </div>
      <div class="components-grid">
    `;

    equipment.evaporators.forEach((evap) => {
      // Motores sin signos de interrogación
      const motorsHtml = evap.motors?.length
        ? evap.motors
            .map(
              (m) => `
                <div class="motor-item">
                  <span class="motor-icon">⚡</span>
                  <span class="motor-detail">${formatValue(m.capacidadHp)}HP</span>
                  <span class="motor-detail">${formatValue(m.voltaje)}V</span>
                  <span class="motor-detail">${formatValue(m.rpm)}RPM</span>
                </div>
              `,
            )
            .join('')
        : '<div class="no-data">Sin motores registrados</div>';

      html += `
        <div class="component-card evaporator-card">
          <div class="component-header">
            <span class="component-title">Evaporador</span>
          </div>
          <div class="component-body">
            <div class="info-row">
              <span class="info-label">Marca:</span>
              <span class="info-value">${formatValue(evap.marca)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Modelo:</span>
              <span class="info-value">${formatValue(evap.modelo)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Serial:</span>
              <span class="info-value">${formatValue(evap.serial)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Capacidad:</span>
              <span class="info-value">${formatValue(evap.capacidad)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refrigerante:</span>
              <span class="info-value">${formatValue(evap.tipoRefrigerante)}</span>
            </div>
            
            <div class="motors-section">
              <div class="motors-title">Motores:</div>
              <div class="motors-list">
                ${motorsHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  };

  // ===== GENERAR HTML DE CONDENSADORES =====
  const condensadoresHtml = () => {
    if (!equipment.condensers?.length) return '';

    let html = `
      <div class="section-title">
        <span class="section-icon">🌬️</span> CONDENSADORAS (${equipment.condensers.length})
      </div>
      <div class="components-grid">
    `;

    equipment.condensers.forEach((cond) => {
      // Motores sin signos de interrogación
      const motorsHtml = cond.motors?.length
        ? cond.motors
            .map(
              (m) => `
                <div class="motor-item">
                  <span class="motor-icon">⚡</span>
                  <span class="motor-detail">${formatValue(m.capacidadHp)}HP</span>
                  <span class="motor-detail">${formatValue(m.voltaje)}V</span>
                  <span class="motor-detail">${formatValue(m.rpm)}RPM</span>
                </div>
              `,
            )
            .join('')
        : '<div class="no-data">Sin motores registrados</div>';

      // Compresores sin signos de interrogación
      const compressorsHtml = cond.compressors?.length
        ? cond.compressors
            .map(
              (c) => `
                <div class="compressor-item">
                  <span class="compressor-icon">🔧</span>
                  <span class="compressor-detail">${formatValue(c.marca)} ${formatValue(c.modelo)}</span>
                  <span class="compressor-detail">${formatValue(c.capacidad)}</span>
                  <span class="compressor-detail">Ref: ${formatValue(c.tipoRefrigerante)}</span>
                </div>
              `,
            )
            .join('')
        : '<div class="no-data">Sin compresores registrados</div>';

      html += `
        <div class="component-card condenser-card">
          <div class="component-header">
            <span class="component-title">Condensadora</span>
          </div>
          <div class="component-body">
            <div class="info-row">
              <span class="info-label">Marca:</span>
              <span class="info-value">${formatValue(cond.marca)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Modelo:</span>
              <span class="info-value">${formatValue(cond.modelo)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Serial:</span>
              <span class="info-value">${formatValue(cond.serial)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Capacidad:</span>
              <span class="info-value">${formatValue(cond.capacidad)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">HP:</span>
              <span class="info-value">${formatValue(cond.hp)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refrigerante:</span>
              <span class="info-value">${formatValue(cond.tipoRefrigerante)}</span>
            </div>
            
            <div class="motors-section">
              <div class="motors-title">Motores:</div>
              <div class="motors-list">
                ${motorsHtml}
              </div>
            </div>
            
            <div class="compressors-section">
              <div class="compressors-title">Compresores:</div>
              <div class="compressors-list">
                ${compressorsHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  };

  // ===== GENERAR HTML DEL PLAN DE MANTENIMIENTO =====
  const planMantenimientoHtml = () => {
    if (!equipment.planMantenimiento) return '';

    return `
      <div class="section-title">
        <span class="section-icon">📅</span> PLAN DE MANTENIMIENTO
      </div>
      <div class="plan-card">
        <div class="plan-grid">
          <div class="plan-item">
            <span class="plan-label">Frecuencia:</span>
            <span class="plan-value">${formatValue(equipment.planMantenimiento.unidadFrecuencia)}</span>
          </div>
          <div class="plan-item">
            <span class="plan-label">Día del Mes:</span>
            <span class="plan-value">${formatValue(equipment.planMantenimiento.diaDelMes)}</span>
          </div>
          <div class="plan-item">
            <span class="plan-label">Próxima Fecha:</span>
            <span class="plan-value">${formatDate(equipment.planMantenimiento.fechaProgramada)}</span>
          </div>
        </div>
        ${
          equipment.planMantenimiento.notas
            ? `
          <div class="plan-notes">
            <span class="plan-label">📝 Notas:</span>
            <span class="plan-value">${equipment.planMantenimiento.notas}</span>
          </div>
        `
            : ''
        }
      </div>
    `;
  };

  // ===== GENERAR HTML DE ÓRDENES =====
  const ordenesHtml = () => {
    if (!historicalOrders.length) {
      return `
        <div class="section-title">
          <span class="section-icon">📋</span> HISTORIAL DE ÓRDENES DE TRABAJO
        </div>
        <div class="empty-state">
          No hay órdenes de trabajo completadas para este equipo.
        </div>
      `;
    }

    let html = `
      <div class="section-title">
        <span class="section-icon">📋</span> HISTORIAL DE ÓRDENES DE TRABAJO (${historicalOrders.length})
      </div>
      <div class="orders-list">
    `;

    historicalOrders.forEach((order) => {
      const insumosHtml = order.supplyDetails?.length
        ? order.supplyDetails
            .map(
              (detail) => `
                <div class="supply-item">
                  <span class="supply-name">${detail.supply?.nombre || 'N/A'}:</span>
                  <span class="supply-quantity">${detail.cantidadUsada || 0} ${detail.supply?.unidadMedida?.nombre || ''}</span>
                </div>
              `,
            )
            .join('')
        : '<div class="no-data">Sin insumos registrados</div>';

      const tecnicosList =
        order.technicians
          ?.map(
            (t) =>
              `${t.technician?.nombre || ''} ${t.technician?.apellido || ''}${t.isLeader ? ' (Líder)' : ''}`,
          )
          .join(', ') || 'Sin técnicos';

      const tiempoOrden =
        order.timers?.reduce((sum, t) => sum + (t.totalSeconds || 0), 0) || 0;

      html += `
        <div class="order-card">
          <div class="order-header">
            <div class="order-title">
              <span class="order-id">Orden #${order.ordenId}</span>
              <span class="order-badge">${order.estado}</span>
            </div>
          </div>
          <div class="order-body">
            <div class="order-grid">
              <div class="order-info">
                <span class="info-label">Fecha:</span>
                <span class="info-value">${formatDate(order.fechaFinalizacion || order.fechaSolicitud)}</span>
              </div>
              <div class="order-info">
                <span class="info-label">Servicio:</span>
                <span class="info-value">${order.service?.nombreServicio || 'N/A'}</span>
              </div>
              <div class="order-info">
                <span class="info-label">Técnicos:</span>
                <span class="info-value">${tecnicosList}</span>
              </div>
              <div class="order-info">
                <span class="info-label">Tiempo:</span>
                <span class="info-value">${formatTime(tiempoOrden)}</span>
              </div>
            </div>
            
            ${
              order.comentarios
                ? `
              <div class="order-comments">
                <span class="info-label">💬 Comentarios:</span>
                <span class="info-value">${order.comentarios}</span>
              </div>
            `
                : ''
            }
            
            <div class="order-supplies">
              <span class="info-label">🛠️ Insumos utilizados:</span>
              <div class="supplies-list">
                ${insumosHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  };

  // ===== CONSTRUIR HTML COMPLETO DE SECCIONES =====
  const componentesCompletos = evaporadoresHtml() + condensadoresHtml();
  const planCompleto = planMantenimientoHtml();
  const ordenesCompleto = ordenesHtml();

  // Badge de estado
  const statusBadge =
    equipment.status === 'Activo' ? 'badge-active' : 'badge-inactive';

  return {
    HEADER_IMAGE: options.headerImageUrl,
    EQUIPMENT_CODE: equipment.code || 'SIN CÓDIGO',
    CLIENT_NAME: equipment.client?.nombre || 'N/A',
    CLIENT_NIT: equipment.client?.nit || 'N/A',
    LOCATION:
      equipment.area && equipment.subArea
        ? `${equipment.area.nombreArea} - ${equipment.subArea.nombreSubArea}`
        : equipment.area
          ? equipment.area.nombreArea
          : 'Sin ubicación',
    INSTALLATION_DATE: formatDate(equipment.installationDate),
    CATEGORY: equipment.category || 'N/A',
    STATUS: equipment.status || 'N/A',
    STATUS_BADGE: statusBadge,

    NOTAS_HTML: notasHtml,
    TOTAL_WORK_ORDERS: totalWorkOrders,
    TOTAL_SUPPLIES_USED: totalSuppliesUsed,
    TOTAL_SERVICE_TIME: formatTime(totalServiceSeconds),
    LAST_MAINTENANCE: historicalOrders[0]
      ? formatDate(historicalOrders[0].fechaFinalizacion)
      : 'N/A',
    COMPONENTES_HTML: componentesCompletos,
    PLAN_HTML: planCompleto,
    ORDENES_HTML: ordenesCompleto,
    FECHA_GENERACION: formatDateTime(new Date()),
  };
}
