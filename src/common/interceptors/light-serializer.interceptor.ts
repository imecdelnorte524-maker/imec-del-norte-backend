// src/common/interceptors/light-serializer.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type LightVersion<T> = {
  [K in keyof T]?: T[K] extends object ? LightVersion<T[K]> : T[K];
};

@Injectable()
export class LightSerializerInterceptor<T> implements NestInterceptor<
  T,
  LightVersion<T> | LightVersion<T>[]
> {
  constructor(private readonly fields: string[]) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<LightVersion<T> | LightVersion<T>[]> {
    return next.handle().pipe(
      map((data) => {
        if (Array.isArray(data)) {
          return data.map((item) => this.serialize(item));
        }
        return this.serialize(data);
      }),
    );
  }

  private serialize(obj: any): LightVersion<T> {
    if (!obj || typeof obj !== 'object') return obj;

    const result: any = {};

    for (const field of this.fields) {
      if (field.includes('.')) {
        // Manejar campos anidados (ej: "user.nombre")
        const parts = field.split('.');
        let value = obj;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) break;
        }
        if (value !== undefined) {
          // Construir objeto anidado
          let current = result;
          for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = current[parts[i]] || {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
        }
      } else if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }

    return result;
  }
}
