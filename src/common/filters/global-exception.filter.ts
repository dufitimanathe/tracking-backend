import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../enums';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const typed = body as {
          success?: boolean;
          error?: { code?: string; message?: string; details?: unknown };
          message?: string | string[];
          code?: string;
        };
        if (typed.error) {
          code = typed.error.code ?? code;
          message = typed.error.message ?? message;
          details = typed.error.details;
        } else {
          code =
            status === HttpStatus.UNAUTHORIZED
              ? ErrorCode.UNAUTHORIZED
              : status === HttpStatus.FORBIDDEN
                ? ErrorCode.FORBIDDEN
                : status === HttpStatus.NOT_FOUND
                  ? ErrorCode.NOT_FOUND
                  : status === HttpStatus.TOO_MANY_REQUESTS
                    ? ErrorCode.RATE_LIMITED
                    : ErrorCode.VALIDATION_ERROR;
          message = Array.isArray(typed.message)
            ? typed.message.join(', ')
            : (typed.message ?? exception.message);
          details = typed.message;
        }
      } else if (typeof body === 'string') {
        message = body;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        {
          event: 'unhandled_exception',
          requestId: request.requestId,
          path: request.url,
          method: request.method,
        },
        exception.stack,
      );
    }

    const isProd = process.env.NODE_ENV === 'production';
    response.status(status).json({
      success: false,
      error: {
        code,
        message: isProd && status === 500 ? 'An unexpected error occurred.' : message,
        ...(details && !isProd ? { details } : {}),
      },
      meta: {
        requestId: request.requestId,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
