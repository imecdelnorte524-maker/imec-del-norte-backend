// src/common/decorators/light-response.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const LIGHT_RESPONSE_KEY = 'light_response';

/**
 * Decorador para marcar endpoints que deben devolver versión ligera
 * @param fields Campos a incluir en la respuesta
 */
export const LightResponse = (fields: string[]) =>
  SetMetadata(LIGHT_RESPONSE_KEY, fields);
