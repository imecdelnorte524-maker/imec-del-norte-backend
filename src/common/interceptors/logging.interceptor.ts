import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query, user } = request;
    const now = Date.now();

    this.logger.log(
      `[${method}] ${url} - Inicio - User: ${user?.userId || 'Anónimo'} - Body: ${JSON.stringify(body)} - Params: ${JSON.stringify(params)} - Query: ${JSON.stringify(query)}`
    );

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        this.logger.log(
          `[${method}] ${url} - Fin - Tiempo: ${responseTime}ms - User: ${user?.userId || 'Anónimo'}`
        );
      }),
    );
  }
}