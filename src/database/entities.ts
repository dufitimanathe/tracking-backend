import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { TransportRequestApproval } from '../approvals/entities/transport-request-approval.entity';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { PricingRule } from '../billing/entities/pricing-rule.entity';
import { CompanyOnboarding } from '../companies/entities/company-onboarding.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { Employee } from '../employees/entities/employee.entity';
import { GpsDevice } from '../gps-devices/entities/gps-device.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { LocationPing } from '../locations/entities/location-ping.entity';
import { MotorcycleCurrentLocation } from '../locations/entities/motorcycle-current-location.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEvent } from '../trip-events/entities/trip-event.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { WhatsAppMessage } from '../whatsapp/entities/whatsapp-message.entity';

export const entities = [
  User,
  Company,
  CompanyOnboarding,
  CompanyMember,
  RefreshToken,
  PasswordResetToken,
  Employee,
  Rider,
  Motorcycle,
  RiderMotorcycleAssignment,
  GpsDevice,
  LocationPing,
  MotorcycleCurrentLocation,
  TransportRequest,
  TransportRequestApproval,
  Trip,
  TripEvent,
  PricingRule,
  BillingRecord,
  Invoice,
  InvoiceLine,
  Incident,
  Notification,
  AuditLog,
  WhatsAppMessage,
];
