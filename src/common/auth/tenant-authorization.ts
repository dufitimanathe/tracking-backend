import { UserRole } from '../enums';

/**
 * Pure tenant authorization helpers — unit-tested without Nest DI.
 */
export function canAccessCompanyResource(params: {
  actorCompanyId: string;
  resourceCompanyId: string;
  actorRole: UserRole;
}): boolean {
  if (params.actorRole === UserRole.PLATFORM_ADMIN) {
    return true;
  }
  return params.actorCompanyId === params.resourceCompanyId;
}

export function canViewFleetDashboard(role: UserRole): boolean {
  return (
    role === UserRole.PLATFORM_ADMIN ||
    role === UserRole.COMPANY_ADMIN ||
    role === UserRole.SUPERVISOR
  );
}
