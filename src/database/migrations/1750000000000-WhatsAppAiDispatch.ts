import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsAppAiDispatch1750000000000 implements MigrationInterface {
  name = 'WhatsAppAiDispatch1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "whatsapp_conversations_state_enum" AS ENUM (
        'NEW','PARSING','WAITING_FOR_PICKUP','WAITING_FOR_DESTINATION','WAITING_FOR_TIME',
        'WAITING_FOR_LOCATION_SELECTION','READY_FOR_CONFIRMATION','SUBMITTED',
        'AWAITING_SUPERVISOR','APPROVED','ASSIGNING_RIDER','RIDER_ASSIGNED','REJECTED','CANCELLED'
      );
      CREATE TYPE "whatsapp_messages_processingstatus_enum" AS ENUM (
        'RECEIVED','QUEUED','PROCESSING','PROCESSED','FAILED','DUPLICATE'
      );
      CREATE TYPE "assignment_attempts_method_enum" AS ENUM (
        'ROUTE_MATRIX','POSTGIS_FALLBACK','MANUAL'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "whatsapp_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid,
        "employeeId" uuid,
        "phone" varchar(30) NOT NULL,
        "state" "whatsapp_conversations_state_enum" NOT NULL DEFAULT 'NEW',
        "language" varchar(10),
        "draft" jsonb,
        "pendingCandidates" jsonb,
        "transportRequestId" uuid,
        "lastMessageAt" TIMESTAMPTZ,
        CONSTRAINT "PK_whatsapp_conversations" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "uq_whatsapp_conversations_phone"
        ON "whatsapp_conversations" ("phone");
      CREATE INDEX "idx_whatsapp_conversations_company"
        ON "whatsapp_conversations" ("companyId", "state");
    `);

    await queryRunner.query(`
      ALTER TABLE "whatsapp_messages"
        ADD COLUMN IF NOT EXISTS "messageType" varchar(40),
        ADD COLUMN IF NOT EXISTS "messageBody" text,
        ADD COLUMN IF NOT EXISTS "language" varchar(10),
        ADD COLUMN IF NOT EXISTS "requestId" uuid,
        ADD COLUMN IF NOT EXISTS "processingStatus" "whatsapp_messages_processingstatus_enum"
          NOT NULL DEFAULT 'RECEIVED';
    `);

    await queryRunner.query(`
      CREATE TABLE "transport_request_parsings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid,
        "employeeId" uuid,
        "whatsappMessageId" uuid,
        "transportRequestId" uuid,
        "originalText" text NOT NULL,
        "model" varchar(100),
        "intent" varchar(64),
        "structured" jsonb NOT NULL,
        "confidence" double precision NOT NULL DEFAULT 0,
        "needsClarification" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_transport_request_parsings" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_transport_request_parsings_company"
        ON "transport_request_parsings" ("companyId", "createdAt");
    `);

    await queryRunner.query(`
      ALTER TABLE "transport_requests"
        ADD COLUMN IF NOT EXISTS "pickupPlaceId" varchar(255),
        ADD COLUMN IF NOT EXISTS "destinationPlaceId" varchar(255),
        ADD COLUMN IF NOT EXISTS "pickupDisplayName" varchar(500),
        ADD COLUMN IF NOT EXISTS "destinationDisplayName" varchar(500),
        ADD COLUMN IF NOT EXISTS "aiAssisted" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE TABLE "assignment_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "tripId" uuid NOT NULL,
        "transportRequestId" uuid,
        "candidates" jsonb NOT NULL DEFAULT '[]',
        "selectedRiderId" uuid,
        "selectedMotorcycleId" uuid,
        "method" "assignment_attempts_method_enum" NOT NULL,
        "reason" text,
        "success" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_assignment_attempts" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_assignment_attempts_trip" ON "assignment_attempts" ("tripId", "createdAt");
      CREATE INDEX "idx_assignment_attempts_company" ON "assignment_attempts" ("companyId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "provider" varchar(40) NOT NULL,
        "eventType" varchar(80) NOT NULL,
        "success" boolean NOT NULL DEFAULT true,
        "message" text,
        "meta" jsonb,
        CONSTRAINT "PK_integration_events" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_integration_events_provider"
        ON "integration_events" ("provider", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_attempts"`);
    await queryRunner.query(`
      ALTER TABLE "transport_requests"
        DROP COLUMN IF EXISTS "aiAssisted",
        DROP COLUMN IF EXISTS "destinationDisplayName",
        DROP COLUMN IF EXISTS "pickupDisplayName",
        DROP COLUMN IF EXISTS "destinationPlaceId",
        DROP COLUMN IF EXISTS "pickupPlaceId";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "transport_request_parsings"`);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_messages"
        DROP COLUMN IF EXISTS "processingStatus",
        DROP COLUMN IF EXISTS "requestId",
        DROP COLUMN IF EXISTS "language",
        DROP COLUMN IF EXISTS "messageBody",
        DROP COLUMN IF EXISTS "messageType";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversations"`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "assignment_attempts_method_enum";
      DROP TYPE IF EXISTS "whatsapp_messages_processingstatus_enum";
      DROP TYPE IF EXISTS "whatsapp_conversations_state_enum";
    `);
  }
}
