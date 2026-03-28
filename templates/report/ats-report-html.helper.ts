// templates/report/ats-report-html.helper.ts

import { Form } from "../../src/sg-sst/entities/form.entity";
import { Signature, SignatureType } from "../../src/sg-sst/entities/signature.entity";

export interface AtsReportHtmlOptions {
  headerImageUrl?: string;
}

function buildCategoryListHtml(data: any, emptyMsg: string): string {
  if (!data) {
    return `<div class="no-data">${emptyMsg}</div>`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `<div class="no-data">${emptyMsg}</div>`;
    }
    return `
      <ul class="bullet-list">
        ${data
          .map(
            (item) =>
              `<li class="bullet-item">${String(item).trim() || 'Sin descripción'}</li>`,
          )
          .join('')}
      </ul>
    `;
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return `<div class="no-data">${emptyMsg}</div>`;
    }

    let html = '';
    for (const [category, value] of entries) {
      const catName = String(category).toUpperCase();
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        html += `
          <div class="category-block">
            <div class="category-title">${catName}</div>
            <div class="tag-list">
              ${value
                .map(
                  (v) =>
                    `<span class="tag">${String(v).trim() || 'Sin descripción'}</span>`,
                )
                .join('')}
            </div>
          </div>
        `;
      } else if (value) {
        html += `
          <div class="category-block">
            <div class="category-title">${catName}</div>
            <div class="tag-list">
              <span class="tag">${String(value).trim() || 'Aplicable'}</span>
            </div>
          </div>
        `;
      }
    }
    return html || `<div class="no-data">${emptyMsg}</div>`;
  }

  return `<div class="no-data">${emptyMsg}</div>`;
}

function buildRisksHtml(selectedRisks: any): string {
  return buildCategoryListHtml(
    selectedRisks,
    'No se registraron riesgos específicos.',
  );
}

function buildPpeHtml(requiredPpe: any): string {
  return buildCategoryListHtml(
    requiredPpe,
    'No se registraron elementos de protección personal.',
  );
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
    // Si ya viene con etiqueta img, la dejamos igual
    if (signature.signatureData.includes('<img')) {
      params[`${prefix}_SIGNATURE_IMAGE`] = signature.signatureData;
    }
    // Si es base64 (empieza con data:image)
    else if (signature.signatureData.startsWith('data:image')) {
      params[`${prefix}_SIGNATURE_IMAGE`] =
        `<img src="${signature.signatureData}" alt="Firma ${prefix}" style="max-width: 180px; max-height: 70px; object-fit: contain;" />`;
    }
    // Si es una URL
    else {
      params[`${prefix}_SIGNATURE_IMAGE`] =
        `<img src="${signature.signatureData}" alt="Firma ${prefix}" style="max-width: 180px; max-height: 70px; object-fit: contain;" />`;
    }
  } else {
    params[`${prefix}_SIGNATURE_IMAGE`] =
      '<span class="no-signature">Sin firma</span>';
  }
}

/**
 * Construye todos los params para templates/pdf/ats_report.html
 */
export function buildAtsReportParams(
  form: Form,
  options: AtsReportHtmlOptions = {},
): Record<string, any> {
  const ats = form.atsReport;
  if (!ats) {
    throw new Error('El formulario ATS no tiene reporte asociado');
  }

  const headerImageUrl = options.headerImageUrl ?? '';

  const params: Record<string, any> = {
    HEADER_IMAGE: headerImageUrl,
    FORM_ID: form.id,
    FORM_TYPE: form.formType,
    FORM_CREATED_AT: form.createdAt.toISOString(),
    FORM_STATUS: form.status,
    WORK_ORDER_ID: form.workOrderId ?? '',
    USER_NAME: `${form.user?.nombre ?? ''} ${form.user?.apellido ?? ''}`.trim(),

    WORKER_NAME: ats.workerName,
    WORKER_IDENTIFICATION: ats.workerIdentification ?? '',
    POSITION: ats.position ?? '',
    AREA: ats.area ?? '',
    SUB_AREA: ats.subArea ?? '',
    WORK_TO_PERFORM: ats.workToPerform ?? '',
    LOCATION: ats.location ?? '',
    START_TIME: ats.startTime ?? '',
    END_TIME: ats.endTime ?? '',
    DATE: ats.date ?? '',
    OBSERVATIONS: ats.observations ?? '',
    CLIENT_NAME: ats.clientName ?? '',
    CLIENT_NIT: ats.clientNit ?? '',

    RISKS_HTML: buildRisksHtml(ats.selectedRisks),
    PPE_HTML: buildPpeHtml(ats.requiredPpe),
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
