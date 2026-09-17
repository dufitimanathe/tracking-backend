import { Request } from 'express';
import { AuthUser, CompanyContext } from '../../common/decorators/current-user.decorator';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  company?: CompanyContext;
  isPlatformAdmin?: boolean;
  requestId?: string;
}
