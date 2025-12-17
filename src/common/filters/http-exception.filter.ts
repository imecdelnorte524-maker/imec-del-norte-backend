import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.message;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      
      // Manejar errores específicos de PostgreSQL
      const pgError = exception as any;
      
      if (pgError.code === '23505') { // Unique violation
        message = 'El registro ya existe';
        error = 'Conflict';
      } else if (pgError.code === '23503') { // Foreign key violation
        message = 'Referencia inválida';
        error = 'Bad Request';
      } else {
        message = 'Error en la base de datos';
        error = 'Database Error';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Log del error
    console.error(`[${new Date().toISOString()}] ${request.method} ${request.url}`, {
      status,
      message,
      error,
      exception: exception instanceof Error ? exception.stack : exception,
    });

    response.status(status).json({
      success: false,
      message,
      error,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}