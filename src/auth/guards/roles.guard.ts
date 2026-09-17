import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { DomainException } from '../../common/exceptions/domain.exception';
import { ErrorCode } from '../../common/enums';
import { HttpStatus } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.isPlatformAdmin) {
      return true;
    }

    const companyRole = request.company?.role;
    if (companyRole && requiredRoles.includes(companyRole)) {
      return true;
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not have permission to perform this action.',
      HttpStatus.FORBIDDEN,
    );
  }
}
