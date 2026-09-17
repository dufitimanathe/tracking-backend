import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums';

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
}

export interface CompanyContext {
  companyId: string;
  role: UserRole;
  membershipId: string;
}

export interface RequestContext {
  user: AuthUser;
  company?: CompanyContext;
  requestId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);

export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompanyContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ company?: CompanyContext }>();
    return request.company;
  },
);

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ requestId?: string }>();
  return request.requestId ?? 'unknown';
});
