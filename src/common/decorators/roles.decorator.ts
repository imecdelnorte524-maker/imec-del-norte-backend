import { SetMetadata } from '@nestjs/common';
import { APP_CONSTANTS } from '../../common/constants/app.constants';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Decoradores predefinidos para roles comunes
export const AdminOnly = () => Roles(APP_CONSTANTS.ROLES.ADMIN);
export const AdminOrSecretary = () => Roles(APP_CONSTANTS.ROLES.ADMIN, APP_CONSTANTS.ROLES.SECRETARY);
export const AdminOrTechnician = () => Roles(APP_CONSTANTS.ROLES.ADMIN, APP_CONSTANTS.ROLES.TECHNICIAN);
export const AnyAuthenticated = () => Roles(
  APP_CONSTANTS.ROLES.ADMIN,
  APP_CONSTANTS.ROLES.TECHNICIAN,
  APP_CONSTANTS.ROLES.CLIENT,
  APP_CONSTANTS.ROLES.SECRETARY
);