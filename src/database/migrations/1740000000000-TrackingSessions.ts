import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackingSessions1740000000000 implements MigrationInterface {
  name = 'TrackingSessions1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tracking_sessions_status_enum" AS ENUM ('ACTIVE','COMPLETED','INTERRUPTED');
      CREATE TYPE "tracking_sessions_movementstate_enum" AS ENUM (
        'OFF_DUTY','READY','TRACKING','MOVING','STOPPED','OFFLINE','TRIP_COMPLETED'
      );
      CREATE TYPE "geofences_type_enum" AS ENUM (
        'HEAD_OFFICE','WAREHOUSE','CUSTOMER','PARKING','DEPOT','CHECKPOINT','DELIVERY_ZONE','OTHER'
      );
      CREATE TYPE "geofence_events_type_enum" AS ENUM ('ENTER','EXIT');
    `);

    await queryRunner.query(`
      CREATE TABLE "tracking_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "tripId" uuid,
        "status" "tracking_sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "movementState" "tracking_sessions_movementstate_enum" NOT NULL DEFAULT 'TRACKING',
        "startedAt" TIMESTAMPTZ NOT NULL,
        "endedAt" TIMESTAMPTZ,
        "lastLocationAt" TIMESTAMPTZ,
        "startLatitude" double precision,
        "startLongitude" double precision,
        "endLatitude" double precision,
        "endLongitude" double precision,
        "startLocation" geography(Point,4326),
        "endLocation" geography(Point,4326),
        "totalDistanceMeters" double precision NOT NULL DEFAULT 0,
        "movingDurationSeconds" integer NOT NULL DEFAULT 0,
        "stoppedDurationSeconds" integer NOT NULL DEFAULT 0,
        "maxSpeed" double precision,
        "averageSpeed" double precision,
        "startAddress" varchar(500),
        "endAddress" varchar(500),
        CONSTRAINT "PK_tracking_sessions" PRIMARY KEY ("id")
      );

      CREATE INDEX "idx_tracking_sessions_company_started" ON "tracking_sessions" ("companyId", "startedAt");
      CREATE INDEX "idx_tracking_sessions_rider_status" ON "tracking_sessions" ("riderId", "status");
      CREATE INDEX "idx_tracking_sessions_motorcycle_started" ON "tracking_sessions" ("motorcycleId", "startedAt");
      CREATE INDEX "idx_tracking_sessions_trip" ON "tracking_sessions" ("tripId");
    `);

    await queryRunner.query(`
      ALTER TABLE "location_pings"
        ADD COLUMN IF NOT EXISTS "trackingSessionId" uuid,
        ADD COLUMN IF NOT EXISTS "clientLocationId" uuid,
        ADD COLUMN IF NOT EXISTS "altitude" double precision;

      CREATE INDEX IF NOT EXISTS "idx_location_pings_session_recorded"
        ON "location_pings" ("trackingSessionId", "recordedAt");
      CREATE INDEX IF NOT EXISTS "idx_location_pings_rider_recorded"
        ON "location_pings" ("riderId", "recordedAt");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_location_pings_company_client"
        ON "location_pings" ("companyId", "clientLocationId")
        WHERE "clientLocationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "driver_stops" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "trackingSessionId" uuid NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "location" geography(Point,4326) NOT NULL,
        "startedAt" TIMESTAMPTZ NOT NULL,
        "endedAt" TIMESTAMPTZ,
        "durationSeconds" integer,
        "address" varchar(500),
        CONSTRAINT "PK_driver_stops" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_driver_stops_session" ON "driver_stops" ("trackingSessionId", "startedAt");
      CREATE INDEX "idx_driver_stops_company" ON "driver_stops" ("companyId", "startedAt");
    `);

    await queryRunner.query(`
      CREATE TABLE "geofences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "type" "geofences_type_enum" NOT NULL DEFAULT 'OTHER',
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "center" geography(Point,4326) NOT NULL,
        "radiusMeters" double precision NOT NULL DEFAULT 100,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_geofences" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_geofences_company" ON "geofences" ("companyId", "active");
      CREATE INDEX "idx_geofences_center" ON "geofences" USING GIST ("center");
    `);

    await queryRunner.query(`
      CREATE TABLE "geofence_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "companyId" uuid NOT NULL,
        "geofenceId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "motorcycleId" uuid NOT NULL,
        "trackingSessionId" uuid,
        "type" "geofence_events_type_enum" NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_geofence_events" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_geofence_events_company" ON "geofence_events" ("companyId", "occurredAt");
      CREATE INDEX "idx_geofence_events_geofence" ON "geofence_events" ("geofenceId", "occurredAt");
    `);

    await queryRunner.query(`
      CREATE TABLE "geocode_cache" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "geohash" varchar(16) NOT NULL UNIQUE,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "formattedAddress" varchar(500),
        "placeId" varchar(255),
        "locality" varchar(200),
        "adminArea" varchar(200),
        "country" varchar(100),
        CONSTRAINT "PK_geocode_cache" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "geocode_cache"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geofence_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geofences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_stops"`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_location_pings_company_client";
      DROP INDEX IF EXISTS "idx_location_pings_rider_recorded";
      DROP INDEX IF EXISTS "idx_location_pings_session_recorded";
      ALTER TABLE "location_pings"
        DROP COLUMN IF EXISTS "altitude",
        DROP COLUMN IF EXISTS "clientLocationId",
        DROP COLUMN IF EXISTS "trackingSessionId";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tracking_sessions"`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "geofence_events_type_enum";
      DROP TYPE IF EXISTS "geofences_type_enum";
      DROP TYPE IF EXISTS "tracking_sessions_movementstate_enum";
      DROP TYPE IF EXISTS "tracking_sessions_status_enum";
    `);
  }
}
