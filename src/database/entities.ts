import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EmailActivationToken } from '../auth/entities/email-activation-token.entity';
import { TransportRequestApproval } from '../approvals/entities/transport-request-approval.entity';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { PricingRule } from '../billing/entities/pricing-rule.entity';
import { CompanyOnboarding } from '../companies/entities/company-onboarding.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyDocument } from '../companies/entities/company-document.entity';
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
import { DevicePushToken } from '../notifications/entities/device-push-token.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEvent } from '../trip-events/entities/trip-event.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { WhatsAppMessage } from '../whatsapp/entities/whatsapp-message.entity';
import { WhatsAppConversation } from '../whatsapp/entities/whatsapp-conversation.entity';
import { TransportRequestParsing } from '../whatsapp/entities/transport-request-parsing.entity';
import { AssignmentAttempt } from '../dispatch/entities/assignment-attempt.entity';
import { IntegrationEvent } from '../integrations/entities/integration-event.entity';
import { TrackingSession } from '../tracking/entities/tracking-session.entity';
import { DriverStop } from '../tracking/entities/driver-stop.entity';
import { Geofence } from '../tracking/entities/geofence.entity';
import { GeofenceEvent } from '../tracking/entities/geofence-event.entity';
import { GeocodeCache } from '../tracking/entities/geocode-cache.entity';

export const entities = [
  User,
  Company,
  CompanyOnboarding,
  CompanyDocument,
  CompanyMember,
  RefreshToken,
  PasswordResetToken,
  EmailActivationToken,
  Employee,
  Rider,
  Motorcycle,
  RiderMotorcycleAssignment,
  GpsDevice,
  LocationPing,
  MotorcycleCurrentLocation,
  TrackingSession,
  DriverStop,
  Geofence,
  GeofenceEvent,
  GeocodeCache,
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
  DevicePushToken,
  AuditLog,
  WhatsAppMessage,
  WhatsAppConversation,
  TransportRequestParsing,
  AssignmentAttempt,
  IntegrationEvent,
];
