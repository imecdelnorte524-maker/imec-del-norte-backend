// src/pdf/interfaces/pdf-diagnose.interface.ts
export interface PdfDiagnoseResponse {
  directories: {
    templates: { exists: boolean; path: string };
    temp: { exists: boolean; path: string };
    pdfs: { exists: boolean; path: string };
  };
  wkhtmltopdf: {
    installed: boolean;
    version: string | null; // 👈 Importante: acepta string o null
  };
  templates: string[];
}