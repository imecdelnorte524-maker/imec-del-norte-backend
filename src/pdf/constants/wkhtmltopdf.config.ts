// src/pdf/constants/wkhtmltopdf.config.ts
export const WKHTMLTOPDF_CONFIG = {
  options: [
    '--page-size',
    'A4',
    '--margin-left',
    '0',
    '--margin-right',
    '0',
    '--dpi',
    '96',
    '--zoom',
    '1',
    '--disable-smart-shrinking',
    '--enable-local-file-access',
    '--load-error-handling',
    'ignore',
    '--load-media-error-handling',
    'ignore',
  ],
  command: 'wkhtmltopdf',
  templates: {
    test: 'test',
    payroll_discount: 'payroll_discount',
    orden_trabajo_interno: 'orden_trabajo_interno',
    orden_trabajo_cliente: 'orden_trabajo_cliente',
    equipment_history: 'historial_equipo',
    ats_report: 'ats_report',
    height_work_report: 'height_work_report',
    preoperational_report: 'preoperational_report',
  } as const,
};

export type PdfTemplateType = keyof typeof WKHTMLTOPDF_CONFIG.templates;