import { UserRole } from '../enums';
import { canAccessCompanyResource, canViewFleetDashboard } from './tenant-authorization';

describe('TenantAuthorization', () => {
  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';

  it('denies cross-tenant access for company admin', () => {
    expect(
      canAccessCompanyResource({
        actorCompanyId: companyA,
        resourceCompanyId: companyB,
        actorRole: UserRole.COMPANY_ADMIN,
      }),
    ).toBe(false);
  });

  it('allows same-tenant access', () => {
    expect(
      canAccessCompanyResource({
        actorCompanyId: companyA,
        resourceCompanyId: companyA,
        actorRole: UserRole.SUPERVISOR,
      }),
    ).toBe(true);
  });

  it('allows platform admin cross-tenant', () => {
    expect(
      canAccessCompanyResource({
        actorCompanyId: companyA,
        resourceCompanyId: companyB,
        actorRole: UserRole.PLATFORM_ADMIN,
      }),
    ).toBe(true);
  });

  it('blocks riders and employees from fleet dashboard', () => {
    expect(canViewFleetDashboard(UserRole.RIDER)).toBe(false);
    expect(canViewFleetDashboard(UserRole.EMPLOYEE)).toBe(false);
    expect(canViewFleetDashboard(UserRole.SUPERVISOR)).toBe(true);
  });
});
