export type WoReportWsEvent =
  | { type: 'ready'; userId: number; payload: any }
  | { type: 'sent'; userId: number; payload: any }
  | { type: 'error'; userId: number; payload: any };

export const WO_REPORTS_REDIS_CHANNEL = 'wo-reports:ws-events';
