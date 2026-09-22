import { QueryFailedError } from 'typeorm';

type DriverError = {
  code?: string;
  constraint?: string;
  detail?: string;
};

const CONSTRAINT_MESSAGES: Record<string, string> = {
  users_email_key: 'A user with this email already exists.',
  users_phone_key: 'A user with this phone number already exists.',
  UQ_company_members_user_company: 'This user is already a member of this company.',
  UQ_employees_company_phone:
    'An employee with this phone number already exists in this company.',
  idx_employees_company_phone:
    'An employee with this phone number already exists in this company.',
  UQ_motorcycles_company_plate:
    'A motorcycle with this plate number already exists in this company.',
  UQ_invoices_company_number:
    'An invoice with this number already exists in this company.',
  companies_slug_key: 'A company with this name already exists.',
  uq_whatsapp_conversations_phone:
    'A WhatsApp conversation for this phone already exists.',
};

function extractConstraint(error: QueryFailedError): string | undefined {
  const driver = error.driverError as DriverError | undefined;
  if (driver?.constraint) {
    return driver.constraint;
  }

  const message = error.message ?? '';
  const quoted = message.match(/unique constraint "([^"]+)"/i);
  if (quoted?.[1]) {
    return quoted[1];
  }

  const detail = driver?.detail ?? '';
  if (/Key \(email\)/i.test(detail)) return 'users_email_key';
  if (/Key \(phone\)/i.test(detail) && /users/i.test(message)) {
    return 'users_phone_key';
  }
  if (/Key \("?plateNumber"?\)/i.test(detail)) {
    return 'UQ_motorcycles_company_plate';
  }

  return undefined;
}

export function isPostgresUniqueViolation(error: unknown): error is QueryFailedError {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driver = error.driverError as DriverError | undefined;
  return driver?.code === '23505';
}

export function mapPostgresUniqueViolation(error: unknown): string | null {
  if (!isPostgresUniqueViolation(error)) {
    return null;
  }

  const constraint = extractConstraint(error);
  if (constraint && CONSTRAINT_MESSAGES[constraint]) {
    return CONSTRAINT_MESSAGES[constraint];
  }

  return 'This record already exists. Please check for duplicates and try again.';
}
