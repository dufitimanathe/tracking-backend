import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ConflictDomainException } from '../exceptions/domain.exception';
import { ErrorCode } from '../enums';

function render(exception: unknown) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ requestId: 'request', url: '/api/v1/test', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return { status: response.status.mock.calls[0][0], body: response.json.mock.calls[0][0] };
}

describe('GlobalExceptionFilter', () => {
  it('reports missing routes as NOT_FOUND instead of INTERNAL_ERROR', () => {
    const result = render(new NotFoundException('Cannot POST /api/v1/test'));
    expect(result.status).toBe(404);
    expect(result.body.error).toMatchObject({
      code: ErrorCode.NOT_FOUND,
      message: 'Cannot POST /api/v1/test',
    });
    expect(result.body.meta.requestId).toBe('request');
  });

  it('preserves validation errors with the standard Nest error string', () => {
    const result = render(
      new BadRequestException(['password is required', 'email must be an email']),
    );
    expect(result.status).toBe(400);
    expect(result.body.error).toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'password is required, email must be an email',
    });
  });

  it('reports authorization and rate-limit responses correctly', () => {
    expect(render(new UnauthorizedException()).body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    const result = render(
      new HttpException(
        { statusCode: 429, error: 'Too Many Requests', message: 'Too many requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(result.status).toBe(429);
    expect(result.body.error).toMatchObject({
      code: ErrorCode.RATE_LIMITED,
      message: 'Too many requests',
    });
  });

  it('preserves structured domain errors', () => {
    const result = render(
      new ConflictDomainException(ErrorCode.NO_RIDER_AVAILABLE, 'No driver available'),
    );
    expect(result.status).toBe(409);
    expect(result.body.error).toMatchObject({
      code: ErrorCode.NO_RIDER_AVAILABLE,
      message: 'No driver available',
    });
  });

  it('keeps unexpected server details private in production', () => {
    const previous = process.env.NODE_ENV;
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    try {
      const result = render(new Error('private database details'));
      expect(result.status).toBe(500);
      expect(result.body.error).toEqual({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
      });
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      log.mockRestore();
    }
  });
});
