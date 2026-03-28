export type WoSingleReportJobData = {
  kind: 'single';
  userId: number;
  ordenId: number;
  reportType: 'internal' | 'client';
  action: 'download' | 'email';
  toEmail?: string;
  ccEmails?: string[];
};

export type WoBatchReportJobData = {
  kind: 'batch';
  userId: number;
  orderIds: number[];
  reportType: 'internal' | 'client';
  action: 'download' | 'email';
  toEmail?: string;
  ccEmails?: string[];
};

export type WoClientsReportJobData = {
  kind: 'clients';
  userId: number;
  orderIds?: number[];
  message?: string;
};

export type WoReportJobData =
  | WoSingleReportJobData
  | WoBatchReportJobData
  | WoClientsReportJobData;

export const WO_REPORTS_QUEUE = 'wo-reports';
