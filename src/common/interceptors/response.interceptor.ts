import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Mensajes por defecto según el método HTTP
    const defaultMessages = {
      GET: 'Datos obtenidos exitosamente',
      POST: 'Recurso creado exitosamente',
      PUT: 'Recurso actualizado exitosamente',
      PATCH: 'Recurso actualizado exitosamente',
      DELETE: 'Recurso eliminado exitosamente',
    };

    const defaultMessage = defaultMessages[request.method] || 'Operación exitosa';

    return next.handle().pipe(
      map(data => {
        // Si ya tiene un formato de respuesta estructurado, no lo modificamos
        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
          return {
            success: true,
            ...data,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          message: defaultMessage,
          data: data || null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}