// notifications/enums/notification-types.enum.ts
export enum NotificationType {
  // Work Orders
  WORK_ORDER_CREATED = 'WORK_ORDER_CREATED',
  WORK_ORDER_ASSIGNED = 'WORK_ORDER_ASSIGNED',
  WORK_ORDER_COMPLETED = 'WORK_ORDER_COMPLETED',
  WORK_ORDER_CANCELLED = 'WORK_ORDER_CANCELLED',
  WORK_ORDER_INVOICED = 'WORK_ORDER_INVOICED',
  WORK_ORDER_IN_PROGRESS = 'WORK_ORDER_IN_PROGRESS',

  // Inventory
  STOCK_BELOW_MIN = 'STOCK_BELOW_MIN',
  STOCK_EXPIRING = 'STOCK_EXPIRING',
  STOCK_OUT = 'STOCK_OUT',
  INVENTORY_ADJUSTED = 'INVENTORY_ADJUSTED',

  // Users
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN_NEW_DEVICE = 'USER_LOGIN_NEW_DEVICE',

  // SST (Seguridad y Salud en el Trabajo)
  SST_DOCUMENT_EXPIRING = 'SST_DOCUMENT_EXPIRING',
  SST_EXPIRED = 'SST_EXPIRED',
  SST_ACCIDENT_REPORTED = 'SST_ACCIDENT_REPORTED',
  SST_INSPECTION_DUE = 'SST_INSPECTION_DUE',

  // Payments
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  INVOICE_GENERATED = 'INVOICE_GENERATED',

  // System
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  SYSTEM_BACKUP_COMPLETED = 'SYSTEM_BACKUP_COMPLETED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

// notifications/enums/notification-module.enum.ts
export enum NotificationModule {
  WORK_ORDERS = 'work_orders',
  INVENTORY = 'inventory',
  USERS = 'users',
  SST = 'sst',
  PAYMENTS = 'payments',
  SYSTEM = 'system',
}

// Mapeo de tipos a módulos
export const NotificationTypeToModule: Record<
  NotificationType,
  NotificationModule
> = {
  // Work Orders
  [NotificationType.WORK_ORDER_CREATED]: NotificationModule.WORK_ORDERS,
  [NotificationType.WORK_ORDER_ASSIGNED]: NotificationModule.WORK_ORDERS,
  [NotificationType.WORK_ORDER_COMPLETED]: NotificationModule.WORK_ORDERS,
  [NotificationType.WORK_ORDER_CANCELLED]: NotificationModule.WORK_ORDERS,
  [NotificationType.WORK_ORDER_INVOICED]: NotificationModule.WORK_ORDERS,
  [NotificationType.WORK_ORDER_IN_PROGRESS]: NotificationModule.WORK_ORDERS,

  // Inventory
  [NotificationType.STOCK_BELOW_MIN]: NotificationModule.INVENTORY,
  [NotificationType.STOCK_EXPIRING]: NotificationModule.INVENTORY,
  [NotificationType.STOCK_OUT]: NotificationModule.INVENTORY,
  [NotificationType.INVENTORY_ADJUSTED]: NotificationModule.INVENTORY,

  // Users
  [NotificationType.USER_CREATED]: NotificationModule.USERS,
  [NotificationType.USER_UPDATED]: NotificationModule.USERS,
  [NotificationType.USER_DELETED]: NotificationModule.USERS,
  [NotificationType.USER_LOGIN_NEW_DEVICE]: NotificationModule.USERS,

  // SST
  [NotificationType.SST_DOCUMENT_EXPIRING]: NotificationModule.SST,
  [NotificationType.SST_EXPIRED]: NotificationModule.SST,
  [NotificationType.SST_ACCIDENT_REPORTED]: NotificationModule.SST,
  [NotificationType.SST_INSPECTION_DUE]: NotificationModule.SST,

  // Payments
  [NotificationType.PAYMENT_RECEIVED]: NotificationModule.PAYMENTS,
  [NotificationType.PAYMENT_OVERDUE]: NotificationModule.PAYMENTS,
  [NotificationType.PAYMENT_REMINDER]: NotificationModule.PAYMENTS,
  [NotificationType.INVOICE_GENERATED]: NotificationModule.PAYMENTS,

  // System
  [NotificationType.SYSTEM_MAINTENANCE]: NotificationModule.SYSTEM,
  [NotificationType.SYSTEM_UPDATE]: NotificationModule.SYSTEM,
  [NotificationType.SYSTEM_BACKUP_COMPLETED]: NotificationModule.SYSTEM,
  [NotificationType.SYSTEM_ERROR]: NotificationModule.SYSTEM,
};

// Niveles de prioridad
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export const NotificationPriorityByType: Record<
  NotificationType,
  NotificationPriority
> = {
  // Work Orders
  [NotificationType.WORK_ORDER_CREATED]: NotificationPriority.MEDIUM,
  [NotificationType.WORK_ORDER_ASSIGNED]: NotificationPriority.HIGH,
  [NotificationType.WORK_ORDER_COMPLETED]: NotificationPriority.MEDIUM,
  [NotificationType.WORK_ORDER_CANCELLED]: NotificationPriority.LOW,
  [NotificationType.WORK_ORDER_INVOICED]: NotificationPriority.LOW,
  [NotificationType.WORK_ORDER_IN_PROGRESS]: NotificationPriority.HIGH,

  // Inventory
  [NotificationType.STOCK_BELOW_MIN]: NotificationPriority.MEDIUM,
  [NotificationType.STOCK_EXPIRING]: NotificationPriority.HIGH,
  [NotificationType.STOCK_OUT]: NotificationPriority.CRITICAL,
  [NotificationType.INVENTORY_ADJUSTED]: NotificationPriority.LOW,

  // Users
  [NotificationType.USER_CREATED]: NotificationPriority.LOW,
  [NotificationType.USER_UPDATED]: NotificationPriority.LOW,
  [NotificationType.USER_DELETED]: NotificationPriority.MEDIUM,
  [NotificationType.USER_LOGIN_NEW_DEVICE]: NotificationPriority.HIGH,

  // SST
  [NotificationType.SST_DOCUMENT_EXPIRING]: NotificationPriority.MEDIUM,
  [NotificationType.SST_EXPIRED]: NotificationPriority.HIGH,
  [NotificationType.SST_ACCIDENT_REPORTED]: NotificationPriority.CRITICAL,
  [NotificationType.SST_INSPECTION_DUE]: NotificationPriority.MEDIUM,

  // Payments
  [NotificationType.PAYMENT_RECEIVED]: NotificationPriority.LOW,
  [NotificationType.PAYMENT_OVERDUE]: NotificationPriority.HIGH,
  [NotificationType.PAYMENT_REMINDER]: NotificationPriority.MEDIUM,
  [NotificationType.INVOICE_GENERATED]: NotificationPriority.LOW,

  // System
  [NotificationType.SYSTEM_MAINTENANCE]: NotificationPriority.LOW,
  [NotificationType.SYSTEM_UPDATE]: NotificationPriority.LOW,
  [NotificationType.SYSTEM_BACKUP_COMPLETED]: NotificationPriority.LOW,
  [NotificationType.SYSTEM_ERROR]: NotificationPriority.CRITICAL,
};
