// templates/report/preoperational-report-html.helper.ts
import { Form } from 'src/sg-sst/entities/form.entity';
import { Signature, SignatureType } from 'src/sg-sst/entities/signature.entity';
import { PreoperationalCheck } from '../../src/sg-sst/entities/preoperational-check.entity';
import { CheckValue } from '../../src/shared';

export interface PreoperationalReportHtmlOptions {
  headerImageUrl?: string;
}

function buildPreopChecksHtml(checks: PreoperationalCheck[]): string {
  if (!checks || checks.length === 0) {
    return `<div class="no-data">No se registraron parámetros en el checklist.</div>`;
  }

  const getCategoryClass = (category?: string): string => {
    switch (category) {
      case 'safety':
        return 'category-safety';
      case 'functional':
        return 'category-functional';
      case 'visual':
        return 'category-visual';
      case 'operational':
        return 'category-operational';
      case 'electrical':
        return 'category-electrical';
      default:
        return '';
    }
  };

  const getCategoryLabel = (category?: string): string => {
    switch (category) {
      case 'safety':
        return 'SEGURIDAD';
      case 'functional':
        return 'FUNCIONAL';
      case 'visual':
        return 'VISUAL';
      case 'operational':
        return 'OPERACIONAL';
      case 'electrical':
        return 'ELÉCTRICO';
      default:
        return category?.toUpperCase() || 'OTRO';
    }
  };

  const getValueClass = (value: CheckValue): string => {
    return `value-${value}`;
  };

  const getValueLabel = (value: CheckValue): string => {
    switch (value) {
      case CheckValue.GOOD:
        return 'BUENO';
      case CheckValue.BAD:
        return 'MALO';
      case CheckValue.REGULAR:
        return 'REGULAR';
      case CheckValue.YES:
        return 'SÍ';
      case CheckValue.NO:
        return 'NO';
      default:
        return value || 'N/A';
    }
  };

  // Calcular resumen
  const total = checks.length;
  const good = checks.filter(
    (c) => c.value === CheckValue.GOOD || c.value === CheckValue.YES,
  ).length;
  const bad = checks.filter(
    (c) => c.value === CheckValue.BAD || c.value === CheckValue.NO,
  ).length;
  const regular = checks.filter((c) => c.value === CheckValue.REGULAR).length;

  const rows = checks
    .map(
      (c) => `
      <tr>
        <td>
          <strong>${c.parameter || ''}</strong>
        </td>
        <td style="text-align: center;">
          <span class="value-badge ${getValueClass(c.value)}">
            ${getValueLabel(c.value)}
          </span>
        </td>
        <td>${c.observations || ''}</td>
      </tr>
    `,
    )
    .join('');

  return `
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-number">${total}</div>
        <div class="summary-label">Total Items</div>
      </div>
      <div class="summary-item">
        <div class="summary-number" style="color: #22543d;">${good}</div>
        <div class="summary-label">Aprobados</div>
      </div>
      ${
        regular > 0
          ? `
        <div class="summary-item">
          <div class="summary-number" style="color: #744210;">${regular}</div>
          <div class="summary-label">Regulares</div>
        </div>
      `
          : ''
      }
      ${
        bad > 0
          ? `
        <div class="summary-item">
          <div class="summary-number" style="color: #742a2a;">${bad}</div>
          <div class="summary-label">Fallas</div>
        </div>
      `
          : ''
      }
    </div>
    <table class="preop-table">
      <thead>
        <tr>
          <th>Parámetro</th>
          <th>Estado</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function populateSignatureParams(
  prefix: 'TECH' | 'SST',
  signature: Signature | undefined,
  params: Record<string, any>,
) {
  params[`${prefix}_SIGNER_NAME`] = signature?.userName ?? '';
  params[`${prefix}_SIGNED_AT`] = signature
    ? signature.signedAt.toISOString()
    : '';
  params[`${prefix}_SIGN_METHOD`] = signature?.method ?? '';
  params[`${prefix}_SIGN_IP`] = signature?.ip ?? '';
  params[`${prefix}_SIGN_USER_AGENT`] = signature?.userAgent ?? '';
  params[`${prefix}_SIGN_CONTACT`] = signature?.contactSnapshot ?? '';

  // CORREGIDO: Formatear la firma como imagen si existe
  if (signature?.signatureData) {
    if (signature.signatureData.includes('<img')) {
      params[`${prefix}_SIGNATURE_IMAGE`] = signature.signatureData;
    } else if (signature.signatureData.startsWith('data:image')) {
      params[`${prefix}_SIGNATURE_IMAGE`] =
        `<img src="${signature.signatureData}" alt="Firma ${prefix}" style="max-width: 180px; max-height: 70px; object-fit: contain;" />`;
    } else {
      params[`${prefix}_SIGNATURE_IMAGE`] =
        `<img src="${signature.signatureData}" alt="Firma ${prefix}" style="max-width: 180px; max-height: 70px; object-fit: contain;" />`;
    }
  } else {
    params[`${prefix}_SIGNATURE_IMAGE`] =
      '<span class="no-signature">Sin firma</span>';
  }
}

/**
 * Params para templates/pdf/preoperational_report.html
 */
export function buildPreoperationalReportParams(
  form: Form,
  options: PreoperationalReportHtmlOptions = {},
): Record<string, any> {
  const headerImageUrl = options.headerImageUrl ?? '';

  const params: Record<string, any> = {
    HEADER_IMAGE: headerImageUrl,
    FORM_ID: form.id,
    FORM_TYPE: form.formType,
    FORM_CREATED_AT: form.createdAt.toISOString(),
    FORM_STATUS: form.status,
    WORK_ORDER_ID: form.workOrderId ?? '',
    USER_NAME: `${form.user?.nombre ?? ''} ${form.user?.apellido ?? ''}`.trim(),

    EQUIPMENT_TOOL: form.equipmentTool ?? '',
    PREOP_CHECKS_HTML: buildPreopChecksHtml(
      (form.preoperationalChecks ?? []) as PreoperationalCheck[],
    ),
  };

  const techSig = form.signatures?.find(
    (s) => s.signatureType === SignatureType.TECHNICIAN,
  );
  const sstSig = form.signatures?.find(
    (s) => s.signatureType === SignatureType.SST,
  );

  populateSignatureParams('TECH', techSig, params);
  populateSignatureParams('SST', sstSig, params);

  return params;
}
