import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1730000000000 implements MigrationInterface {
  name = 'InitSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TYPE "users_status_enum" AS ENUM ('ACTIVE','INACTIVE','SUSPENDED','PENDING_VERIFICATION');
      CREATE TYPE "companies_status_enum" AS ENUM ('ACTIVE','SUSPENDED','INACTIVE');
      CREATE TYPE "companies_billingperiod_enum" AS ENUM ('DAILY','WEEKLY','MONTHLY');
      CREATE TYPE "companies_billingdistancesource_enum" AS ENUM ('ROUTE_ESTIMATE','GPS_DISTANCE');
      CREATE TYPE "company_members_role_enum" AS ENUM ('PLATFORM_ADMIN','COMPANY_ADMIN','SUPERVISOR','RIDER','EMPLOYEE');
      CREATE TYPE "company_members_status_enum" AS ENUM ('ACTIVE','INVITED','SUSPENDED','LEFT');
      CREATE TYPE "employees_status_enum" AS ENUM ('ACTIVE','INACTIVE','SUSPENDED');
      CREATE TYPE "riders_status_enum" AS ENUM ('ACTIVE','INACTIVE','SUSPENDED');
      CREATE TYPE "riders_availabilitystatus_enum" AS ENUM ('OFFLINE','AVAILABLE','RESERVED','ASSIGNED','TO_PICKUP','WAITING_CUSTOMER','ON_TRIP');
      CREATE TYPE "motorcycles_status_enum" AS ENUM ('ACTIVE','INACTIVE','MAINTENANCE','SUSPENDED');
      CREATE TYPE "motorcycles_trackingstatus_enum" AS ENUM ('ONLINE','OFFLINE','PARKED','MOVING','UNAUTHORIZED_MOVEMENT');
      CREATE TYPE "gps_devices_status_enum" AS ENUM ('ACTIVE','INACTIVE','OFFLINE','FAULTY');
      CREATE TYPE "location_pings_source_enum" AS ENUM ('RIDER_APP','GPS_DEVICE');
      CREATE TYPE "transport_requests_channel_enum" AS ENUM ('WHATSAPP','WEB','ADMIN');
      CREATE TYPE "transport_requests_status_enum" AS ENUM ('PENDING_CONFIRMATION','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED','DISPATCHING','ASSIGNED','COMPLETED');
      CREATE TYPE "transport_request_approvals_action_enum" AS ENUM ('APPROVED','REJECTED');
      CREATE TYPE "trips_status_enum" AS ENUM ('SEARCHING_RIDER','RIDER_ASSIGNED','RIDER_ACCEPTED','RIDER_TO_PICKUP','RIDER_ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_RIDER_AVAILABLE');
      CREATE TYPE "trip_events_type_enum" AS ENUM ('REQUEST_CREATED','REQUEST_APPROVED','REQUEST_REJECTED','DISPATCH_STARTED','RIDER_ASSIGNED','RIDER_ACCEPTED','RIDER_DECLINED','RIDER_ARRIVED','TRIP_STARTED','TRIP_COMPLETED','TRIP_CANCELLED','RIDER_REASSIGNED','OFFER_EXPIRED');
      CREATE TYPE "billing_records_billingstatus_enum" AS ENUM ('PENDING','BILLED','INVOICED','CANCELLED');
      CREATE TYPE "invoices_status_enum" AS ENUM ('DRAFT','ISSUED','PAID','OVERDUE','CANCELLED');
      CREATE TYPE "incidents_type_enum" AS ENUM ('UNAUTHORIZED_MOVEMENT','GPS_OFFLINE','GPS_DELAYED','RIDER_OFFLINE_DURING_TRIP','ROUTE_DEVIATION','LONG_STOP');
      CREATE TYPE "incidents_severity_enum" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
      CREATE TYPE "incidents_status_enum" AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED');
      CREATE TYPE "notifications_type_enum" AS ENUM ('TRANSPORT_REQUEST','REQUEST_APPROVED','REQUEST_REJECTED','TRIP_ASSIGNMENT','TRIP_UPDATED','TRIP_COMPLETED','GPS_ALERT','INCIDENT','BILLING','INVOICE','SYSTEM');
      CREATE TYPE "whatsapp_messages_direction_enum" AS ENUM ('INBOUND','OUTBOUND');
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "email" varchar(255) UNIQUE,
        "phone" varchar(30) UNIQUE,
        "passwordHash" varchar(255) NOT NULL,
        "status" "users_status_enum" NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "lastLoginAt" TIMESTAMPTZ,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );

      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "email" varchar(255),
        "phone" varchar(30),
        "address" text,
        "logoUrl" varchar(500),
        "registrationNumber" varchar(100),
        "timezone" varchar(64) NOT NULL DEFAULT 'Africa/Kigali',
        "currency" varchar(3) NOT NULL DEFAULT 'RWF',
        "status" "companies_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "billingPeriod" "companies_billingperiod_enum" NOT NULL DEFAULT 'MONTHLY',
        "billingDistanceSource" "companies_billingdistancesource_enum" NOT NULL DEFAULT 'ROUTE_ESTIMATE',
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      );

      CREATE TABLE "company_onboarding" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL UNIQUE,
        "companyProfileCompleted" boolean NOT NULL DEFAULT false,
        "operationalSettingsCompleted" boolean NOT NULL DEFAULT false,
        "fleetAdded" boolean NOT NULL DEFAULT false,
        "teamAdded" boolean NOT NULL DEFAULT false,
        "completedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_company_onboarding" PRIMARY KEY ("id")
      );

      CREATE TABLE "company_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "companyId" uuid NOT NULL,
        "role" "company_members_role_enum" NOT NULL,
        "status" "company_members_status_enum" NOT NULL DEFAULT 'INVITED',
        "joinedAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_company_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_members_user_company" UNIQUE ("userId", "companyId")
      );
      CREATE INDEX "idx_company_members_user_company" ON "company_members" ("userId", "companyId");

      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userAgent" varchar(500),
        "ipAddress" varchar(45),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      );

      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "usedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id")
      );

      CREATE TABLE "employees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "userId" uuid,
        "fullName" varchar(255) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "email" varchar(255),
        "employeeCode" varchar(50),
        "department" varchar(100),
        "supervisorId" uuid,
        "canRequestTransport" boolean NOT NULL DEFAULT true,
        "status" "employees_status_enum" NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_employees" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employees_company_phone" UNIQUE ("companyId", "phone")
      );

      CREATE TABLE "riders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "phone" varchar(30) NOT NULL,
        "licenseNumber" varchar(100),
        "status" "riders_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "availabilityStatus" "riders_availabilitystatus_enum" NOT NULL DEFAULT 'OFFLINE',
        "currentLatitude" numeric(10,7),
        "currentLongitude" numeric(10,7),
        "locationUpdatedAt" TIMESTAMPTZ,
        "position" geography(Point,4326),
        CONSTRAINT "PK_riders" PRIMARY KEY ("id")
      );

      CREATE TABLE "motorcycles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "plateNumber" varchar(30) NOT NULL,
        "internalCode" varchar(50),
        "brand" varchar(100),
        "model" varchar(100),
        "year" int,
        "color" varchar(50),
        "status" "motorcycles_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "trackingStatus" "motorcycles_trackingstatus_enum" NOT NULL DEFAULT 'OFFLINE',
        CONSTRAINT "PK_motorcycles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_motorcycles_company_plate" UNIQUE ("companyId", "plateNumber")
      );

      CREATE TABLE "rider_motorcycle_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "assignedById" uuid NOT NULL,
        "assignedAt" TIMESTAMPTZ NOT NULL,
        "unassignedAt" TIMESTAMPTZ,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_rider_motorcycle_assignments" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "idx_rma_active_motorcycle" ON "rider_motorcycle_assignments" ("companyId", "motorcycleId") WHERE "active" = true;
      CREATE UNIQUE INDEX "idx_rma_active_rider" ON "rider_motorcycle_assignments" ("companyId", "riderId") WHERE "active" = true;

      CREATE TABLE "gps_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "provider" varchar(100),
        "externalDeviceId" varchar(255) NOT NULL,
        "imei" varchar(50),
        "simNumber" varchar(30),
        "status" "gps_devices_status_enum" NOT NULL DEFAULT 'INACTIVE',
        "lastSeenAt" TIMESTAMPTZ,
        CONSTRAINT "PK_gps_devices" PRIMARY KEY ("id")
      );

      CREATE TABLE "location_pings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "riderId" uuid,
        "tripId" uuid,
        "position" geography(Point,4326) NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "speed" double precision,
        "heading" double precision,
        "accuracy" double precision,
        "ignition" boolean,
        "source" "location_pings_source_enum" NOT NULL,
        "recordedAt" TIMESTAMPTZ NOT NULL,
        "receivedAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_location_pings" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_location_pings_company_id" ON "location_pings" ("companyId");
      CREATE INDEX "idx_location_pings_motorcycle_id" ON "location_pings" ("motorcycleId");
      CREATE INDEX "idx_location_pings_recorded_at" ON "location_pings" ("recordedAt");
      CREATE INDEX "idx_location_pings_company_recorded" ON "location_pings" ("companyId", "recordedAt");

      CREATE TABLE "motorcycle_current_locations" (
        "motorcycleId" uuid NOT NULL,
        "companyId" uuid NOT NULL,
        "position" geography(Point,4326) NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "speed" double precision,
        "heading" double precision,
        "accuracy" double precision,
        "source" "location_pings_source_enum" NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "recordedAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_motorcycle_current_locations" PRIMARY KEY ("motorcycleId")
      );
      CREATE INDEX "idx_mcl_company_id" ON "motorcycle_current_locations" ("companyId");

      CREATE TABLE "transport_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "employeeId" uuid NOT NULL,
        "createdById" uuid,
        "pickupAddress" text NOT NULL,
        "pickupLocation" geography(Point,4326),
        "pickupLatitude" double precision NOT NULL,
        "pickupLongitude" double precision NOT NULL,
        "destinationAddress" text NOT NULL,
        "destinationLocation" geography(Point,4326),
        "destinationLatitude" double precision NOT NULL,
        "destinationLongitude" double precision NOT NULL,
        "requestedAt" TIMESTAMPTZ NOT NULL,
        "requestedPickupTime" TIMESTAMPTZ NOT NULL,
        "channel" "transport_requests_channel_enum" NOT NULL,
        "status" "transport_requests_status_enum" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
        "estimatedDistanceKm" numeric(12,3),
        "estimatedDurationMinutes" int,
        "estimatedPrice" numeric(12,2),
        "notes" text,
        CONSTRAINT "PK_transport_requests" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_transport_requests_company_status" ON "transport_requests" ("companyId", "status");

      CREATE TABLE "transport_request_approvals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "requestId" uuid NOT NULL,
        "supervisorId" uuid NOT NULL,
        "action" "transport_request_approvals_action_enum" NOT NULL,
        "reason" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transport_request_approvals" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_transport_request_approvals_request" ON "transport_request_approvals" ("requestId");

      CREATE TABLE "trips" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "transportRequestId" uuid NOT NULL UNIQUE,
        "employeeId" uuid NOT NULL,
        "riderId" uuid,
        "motorcycleId" uuid,
        "status" "trips_status_enum" NOT NULL DEFAULT 'SEARCHING_RIDER',
        "pickupAddress" text NOT NULL,
        "pickupLocation" geography(Point,4326) NOT NULL,
        "pickupLatitude" double precision NOT NULL,
        "pickupLongitude" double precision NOT NULL,
        "destinationAddress" text NOT NULL,
        "destinationLocation" geography(Point,4326) NOT NULL,
        "destinationLatitude" double precision NOT NULL,
        "destinationLongitude" double precision NOT NULL,
        "estimatedDistanceKm" numeric(12,3),
        "actualDistanceKm" numeric(12,3),
        "estimatedDurationMinutes" int,
        "actualDurationMinutes" int,
        "estimatedPrice" numeric(12,2),
        "finalPrice" numeric(12,2),
        "assignedAt" TIMESTAMPTZ,
        "acceptedAt" TIMESTAMPTZ,
        "arrivedAtPickupAt" TIMESTAMPTZ,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "cancelledAt" TIMESTAMPTZ,
        CONSTRAINT "PK_trips" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_trips_company_status" ON "trips" ("companyId", "status");
      CREATE UNIQUE INDEX "idx_trips_transport_request" ON "trips" ("transportRequestId");

      CREATE TABLE "trip_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "tripId" uuid NOT NULL,
        "type" "trip_events_type_enum" NOT NULL,
        "actorId" uuid,
        "metadata" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_events" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_trip_events_trip_created" ON "trip_events" ("tripId", "createdAt");

      CREATE TABLE "pricing_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid,
        "firstKilometerPrice" numeric(12,2) NOT NULL,
        "additionalKilometerPrice" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'RWF',
        "effectiveFrom" TIMESTAMPTZ NOT NULL,
        "effectiveTo" TIMESTAMPTZ,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_pricing_rules" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_pricing_rules_company_active" ON "pricing_rules" ("companyId", "active");

      CREATE TABLE "billing_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "tripId" uuid NOT NULL UNIQUE,
        "employeeId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "distanceKm" numeric(12,3) NOT NULL,
        "firstKmCharge" numeric(12,2) NOT NULL,
        "additionalKm" numeric(12,3) NOT NULL,
        "additionalKmCharge" numeric(12,2) NOT NULL,
        "totalAmount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'RWF',
        "billingStatus" "billing_records_billingstatus_enum" NOT NULL DEFAULT 'PENDING',
        CONSTRAINT "PK_billing_records" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "idx_billing_records_trip" ON "billing_records" ("tripId");

      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "invoiceNumber" varchar(50) NOT NULL,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "status" "invoices_status_enum" NOT NULL DEFAULT 'DRAFT',
        "subtotal" numeric(12,2) NOT NULL,
        "total" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'RWF',
        "issuedAt" TIMESTAMPTZ,
        "dueAt" TIMESTAMPTZ,
        "paidAt" TIMESTAMPTZ,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invoices_company_number" UNIQUE ("companyId", "invoiceNumber")
      );

      CREATE TABLE "invoice_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "invoiceId" uuid NOT NULL,
        "billingRecordId" uuid,
        "tripId" uuid,
        "description" varchar(500) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'RWF',
        CONSTRAINT "PK_invoice_lines" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_invoice_lines_invoice" ON "invoice_lines" ("invoiceId");

      CREATE TABLE "incidents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "motorcycleId" uuid,
        "riderId" uuid,
        "tripId" uuid,
        "type" "incidents_type_enum" NOT NULL,
        "severity" "incidents_severity_enum" NOT NULL DEFAULT 'MEDIUM',
        "status" "incidents_status_enum" NOT NULL DEFAULT 'OPEN',
        "title" varchar(255) NOT NULL,
        "description" text,
        "detectedAt" TIMESTAMPTZ NOT NULL,
        "acknowledgedAt" TIMESTAMPTZ,
        "acknowledgedById" uuid,
        "resolvedAt" TIMESTAMPTZ,
        "resolvedById" uuid,
        "metadata" jsonb,
        CONSTRAINT "PK_incidents" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_incidents_company_status" ON "incidents" ("companyId", "status");
      CREATE INDEX "idx_incidents_motorcycle_type" ON "incidents" ("motorcycleId", "type");

      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "type" "notifications_type_enum" NOT NULL,
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "relatedEntityType" varchar(100),
        "relatedEntityId" uuid,
        "readAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_notifications_user_created" ON "notifications" ("userId", "createdAt");
      CREATE INDEX "idx_notifications_company_user" ON "notifications" ("companyId", "userId");

      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid,
        "actorId" uuid,
        "action" varchar(100) NOT NULL,
        "entityType" varchar(100) NOT NULL,
        "entityId" uuid NOT NULL,
        "oldValues" jsonb,
        "newValues" jsonb,
        "ipAddress" varchar(45),
        "userAgent" varchar(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_audit_logs_company_created" ON "audit_logs" ("companyId", "createdAt");
      CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entityType", "entityId");

      CREATE TABLE "whatsapp_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "externalMessageId" varchar(255) NOT NULL UNIQUE,
        "companyId" uuid,
        "employeeId" uuid,
        "phone" varchar(30) NOT NULL,
        "direction" "whatsapp_messages_direction_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "processedAt" TIMESTAMPTZ,
        "conversationState" jsonb,
        CONSTRAINT "PK_whatsapp_messages" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "whatsapp_messages";
      DROP TABLE IF EXISTS "audit_logs";
      DROP TABLE IF EXISTS "notifications";
      DROP TABLE IF EXISTS "incidents";
      DROP TABLE IF EXISTS "invoice_lines";
      DROP TABLE IF EXISTS "invoices";
      DROP TABLE IF EXISTS "billing_records";
      DROP TABLE IF EXISTS "pricing_rules";
      DROP TABLE IF EXISTS "trip_events";
      DROP TABLE IF EXISTS "trips";
      DROP TABLE IF EXISTS "transport_request_approvals";
      DROP TABLE IF EXISTS "transport_requests";
      DROP TABLE IF EXISTS "motorcycle_current_locations";
      DROP TABLE IF EXISTS "location_pings";
      DROP TABLE IF EXISTS "gps_devices";
      DROP TABLE IF EXISTS "rider_motorcycle_assignments";
      DROP TABLE IF EXISTS "motorcycles";
      DROP TABLE IF EXISTS "riders";
      DROP TABLE IF EXISTS "employees";
      DROP TABLE IF EXISTS "password_reset_tokens";
      DROP TABLE IF EXISTS "refresh_tokens";
      DROP TABLE IF EXISTS "company_members";
      DROP TABLE IF EXISTS "company_onboarding";
      DROP TABLE IF EXISTS "companies";
      DROP TABLE IF EXISTS "users";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "whatsapp_messages_direction_enum";
      DROP TYPE IF EXISTS "notifications_type_enum";
      DROP TYPE IF EXISTS "incidents_status_enum";
      DROP TYPE IF EXISTS "incidents_severity_enum";
      DROP TYPE IF EXISTS "incidents_type_enum";
      DROP TYPE IF EXISTS "invoices_status_enum";
      DROP TYPE IF EXISTS "billing_records_billingstatus_enum";
      DROP TYPE IF EXISTS "trip_events_type_enum";
      DROP TYPE IF EXISTS "trips_status_enum";
      DROP TYPE IF EXISTS "transport_request_approvals_action_enum";
      DROP TYPE IF EXISTS "transport_requests_status_enum";
      DROP TYPE IF EXISTS "transport_requests_channel_enum";
      DROP TYPE IF EXISTS "location_pings_source_enum";
      DROP TYPE IF EXISTS "gps_devices_status_enum";
      DROP TYPE IF EXISTS "motorcycles_trackingstatus_enum";
      DROP TYPE IF EXISTS "motorcycles_status_enum";
      DROP TYPE IF EXISTS "riders_availabilitystatus_enum";
      DROP TYPE IF EXISTS "riders_status_enum";
      DROP TYPE IF EXISTS "employees_status_enum";
      DROP TYPE IF EXISTS "company_members_status_enum";
      DROP TYPE IF EXISTS "company_members_role_enum";
      DROP TYPE IF EXISTS "companies_billingdistancesource_enum";
      DROP TYPE IF EXISTS "companies_billingperiod_enum";
      DROP TYPE IF EXISTS "companies_status_enum";
      DROP TYPE IF EXISTS "users_status_enum";
    `);
  }
}
