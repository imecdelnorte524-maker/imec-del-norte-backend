export const APP_CONSTANTS = {
  JWT: {
    EXPIRES_IN: '24h',
    ALGORITHM: 'HS256',
  },
  ROLES: {
    ADMIN: 'Administrador',
    TECHNICIAN: 'Técnico',
    CLIENT: 'Cliente',
    SECRETARY: 'Secretaria',
  },
  EQUIPMENT_STATUS: {
    AVAILABLE: 'Disponible',
    IN_USE: 'En Uso',
    MAINTENANCE: 'En Mantenimiento',
    DAMAGED: 'Dañado',
    RETIRED: 'Retirado',
  },
  ORDER_STATUS: {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En Progreso',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
  FILE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
  },
};