// src/common/interceptors/pagination.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { memoryConfig } from '../../config/memory.config';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

@Injectable()
export class PaginationInterceptor<T> implements NestInterceptor<
  T,
  PaginatedResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<PaginatedResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(
      memoryConfig.pagination.maxPageSize,
      parseInt(request.query.limit) || memoryConfig.pagination.defaultPageSize,
    );

    return next.handle().pipe(
      map((data) => {
        if (!Array.isArray(data)) {
          return data; // Si no es array, devolver como está
        }

        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedData = data.slice(start, end);
        const total = data.length;
        const pages = Math.ceil(total / limit);

        return {
          data: paginatedData,
          meta: {
            page,
            limit,
            total,
            pages,
            hasNext: page < pages,
            hasPrevious: page > 1,
          },
        };
      }),
    );
  }
}
