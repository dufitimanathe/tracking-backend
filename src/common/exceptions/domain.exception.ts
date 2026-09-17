import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums';

export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ success: false, error: { code, message, details } }, status);
  }
}

export class CompanyAccessDeniedException extends DomainException {
  constructor(message = 'You do not have access to this company resource.') {
    super(ErrorCode.COMPANY_ACCESS_DENIED, message, HttpStatus.FORBIDDEN);
  }
}

export class TripInvalidStateException extends DomainException {
  constructor(message = 'Trip cannot transition from its current state.') {
    super(ErrorCode.TRIP_INVALID_STATE, message, HttpStatus.CONFLICT);
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(message = 'Resource not found.') {
    super(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(code: ErrorCode | string, message: string) {
    super(code, message, HttpStatus.CONFLICT);
  }
}
