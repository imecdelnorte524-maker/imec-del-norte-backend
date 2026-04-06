//templates/report/height-work-report-html.helper.ts

import { SignatureType } from "src/shared";
import { Form } from "../../src/sg-sst/entities/form.entity";
import { Signature } from "../../src/sg-sst/entities/signature.entity";

export interface HeightWorkReportHtmlOptions {
  headerImageUrl?: string;
}

function booleanToClass(value: boolean | null | undefined): string {
  if (value === true) return 'apto';
  if (value === false) return 'no-apto';
  return 'pendiente';
}

function booleanToLabel(value: boolean | null | undefined): string {
  if (value === true) return 'SÍ';
  if (value === false) return 'NO';
  return 'PENDIENTE';
}

function buildProtectionElementsHtml(protectionElements: any): string {
  if (!protectionElements) {
    return `<div class="no-data">No se registraron elementos de protección.</div>`;
  }

  if (Array.isArray(protectionElements)) {
    if (protectionElements.length === 0) {
      return `<div class="no-data">No se registraron elementos de protección.</div>`;
    }
    return `
      <div class="tag-list">
        ${protectionElements
        .map(
          (item) =>
            `<span class="tag">${String(item).trim() || 'Sin descripción'}</span>`,
        )
        .join('')}
      </div>
    `;
  }

  if (typeof protectionElements === 'object') {
    const entries = Object.entries(protectionElements);
    if (entries.length === 0) {
      return `<div class="no-data">No se registraron elementos de protección.</div>`;
    }

    let html = '<ul class="bullet-list">';
    for (const [key, value] of entries) {
      const label = String(key).replace(/_/g, ' ').toUpperCase();
      let estado = '';
      if (typeof value === 'boolean') {
        estado = booleanToLabel(value);
      } else if (value !== null && value !== undefined) {
        estado = String(value);
      } else {
        estado = 'N/A';
      }

      html += `
        <li class="bullet-item">
          <strong>${label}:</strong> ${estado}
        </li>
      `;
    }
    html += '</ul>';
    return html;
  }

  return `<div class="no-data">No se registraron elementos de protección.</div>`;
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
 * Params para templates/pdf/height_work_report.html
 */
export function buildHeightWorkReportParams(
  form: Form,
  options: HeightWorkReportHtmlOptions = {},
): Record<string, any> {
  const hw = form.heightWork;
  if (!hw) {
    throw new Error(
      'El formulario de trabajo en alturas no tiene registro asociado',
    );
  }

  const headerImageUrl = options.headerImageUrl ?? '';
  const isApto = hw.fitForHeightWork === true;
  const warningHtml = !isApto
    ? `
  <div class="warning-box">
    ⚠️ ADVERTENCIA: El trabajador NO está apto para trabajo en alturas o no se ha registrado su aptitud.
  </div>
`
    : '';

  const params: Record<string, any> = {
    HEADER_IMAGE: headerImageUrl,
    FORM_ID: form.id,
    FORM_TYPE: form.formType,
    FORM_CREATED_AT: form.createdAt.toISOString(),
    FORM_STATUS: form.status,
    WORK_ORDER_ID: form.workOrderId ?? '',
    USER_NAME: `${form.user?.nombre ?? ''} ${form.user?.apellido ?? ''}`.trim(),

    WORKER_NAME: hw.workerName,
    WORKER_IDENTIFICATION: hw.identification ?? '',
    POSITION: hw.position ?? '',
    WORK_DESCRIPTION: hw.workDescription ?? '',
    LOCATION: hw.location ?? '',
    ESTIMATED_TIME: hw.estimatedTime ?? '',

    PROTECTION_ELEMENTS_HTML: buildProtectionElementsHtml(
      hw.protectionElements,
    ),
    PHYSICAL_CONDITION_LABEL: booleanToLabel(hw.physicalCondition),
    INSTRUCTIONS_RECEIVED_LABEL: booleanToLabel(hw.instructionsReceived),
    FIT_FOR_HEIGHT_WORK_LABEL: booleanToLabel(hw.fitForHeightWork),

    AUTHORIZER_NAME: hw.authorizerName ?? '',
    AUTHORIZER_IDENTIFICATION: hw.authorizerIdentification ?? '',
    HEIGHT_WARNING: warningHtml,
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
