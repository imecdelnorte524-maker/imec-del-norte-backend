export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso denegado',
  USER_INACTIVE: 'Usuario inactivo',
  USER_NOT_FOUND: 'Usuario no encontrado',
  REGISTER_SUCCESS: 'Usuario registrado exitosamente',
  EMAIL_EXISTS: 'El correo electrónico ya está registrado',
  USERNAME_EXISTS: 'El nombre de usuario ya existe',
  INVALID_TOKEN: 'Token inválido',
  TOKEN_EXPIRED: 'Token expirado',
};

export const USER_MESSAGES = {
  CREATED: 'Usuario creado exitosamente',
  UPDATED: 'Usuario actualizado exitosamente',
  DELETED: 'Usuario eliminado exitosamente',
  NOT_FOUND: 'Usuario no encontrado',
  DEACTIVATED: 'Usuario desactivado exitosamente',
  ACTIVATED: 'Usuario activado exitosamente',
};

export const SERVICE_MESSAGES = {
  CREATED: 'Servicio creado exitosamente',
  UPDATED: 'Servicio actualizado exitosamente',
  DELETED: 'Servicio eliminado exitosamente',
  NOT_FOUND: 'Servicio no encontrado',
  NAME_EXISTS: 'El nombre del servicio ya existe',
  IN_USE: 'No se puede eliminar el servicio porque está siendo usado en órdenes de trabajo',
};

export const EQUIPMENT_MESSAGES = {
  CREATED: 'Equipo creado exitosamente',
  UPDATED: 'Equipo actualizado exitosamente',
  DELETED: 'Equipo eliminado exitosamente',
  NOT_FOUND: 'Equipo no encontrado',
  SERIAL_EXISTS: 'El número de serie ya está registrado',
  IN_USE: 'No se puede eliminar el herramienta porque está en uso',
  STATUS_UPDATED: 'Estado del herramienta actualizado exitosamente',
  INVALID_STATUS: 'Estado inválido',
};

export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'Este campo es requerido',
  INVALID_EMAIL: 'El correo electrónico no es válido',
  MIN_LENGTH: 'Debe tener al menos {min} caracteres',
  MAX_LENGTH: 'No puede exceder {max} caracteres',
  INVALID_NUMBER: 'Debe ser un número válido',
  INVALID_URL: 'Debe ser una URL válida',
  POSITIVE_NUMBER: 'Debe ser un número positivo',
};

export const GENERAL_MESSAGES = {
  SUCCESS: 'Operación exitosa',
  ERROR: 'Ha ocurrido un error',
  NOT_FOUND: 'Recurso no encontrado',
  CONFLICT: 'Conflicto de datos',
  BAD_REQUEST: 'Solicitud inválida',
  INTERNAL_ERROR: 'Error interno del servidor',
};