import { config as loadEnv } from 'dotenv';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import {
  EmployeeStatus,
  MembershipStatus,
  MotorcycleStatus,
  MotorcycleTrackingStatus,
  RiderAvailabilityStatus,
  RiderStatus,
  UserRole,
  UserStatus,
} from '../../common/enums';
import { toPointWkt } from '../../common/utils/geo.util';
import { entities } from '../entities';

loadEnv();

const ADMIN_EMAIL = 'theodufi.rw@gmail.com';
const ADMIN_PASSWORD = 'Password123!';
const COMPANY_SLUG = 'virunga-transport-ltd';

const KIGALI_LOCATIONS = {
  kimironko: { lat: -1.9595, lng: 30.1228, label: 'Kimironko Market' },
  kacyiru: { lat: -1.9369, lng: 30.0827, label: 'Kacyiru' },
  remera: { lat: -1.9495, lng: 30.1115, label: 'Remera' },
  nyabugogo: { lat: -1.9392, lng: 30.0444, label: 'Nyabugogo' },
  kigaliHeights: { lat: -1.9506, lng: 30.0912, label: 'Kigali Heights' },
};

async function ensureAdmin(
  manager: {
    query: (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;
  },
  passwordHash: string,
  companyId: string,
): Promise<string> {
  const existing = await manager.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
    ADMIN_EMAIL,
  ]);

  let adminUserId: string;
  if (existing.length > 0) {
    adminUserId = existing[0].id as string;
    await manager.query(
      `UPDATE users
       SET "firstName" = $1, "lastName" = $2, phone = $3, "passwordHash" = $4, status = $5, "updatedAt" = now()
       WHERE id = $6`,
      ['Theo', 'Dufit', '+250788100001', passwordHash, UserStatus.ACTIVE, adminUserId],
    );
  } else {
    const inserted = await manager.query(
      `INSERT INTO users ("firstName", "lastName", email, phone, "passwordHash", status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['Theo', 'Dufit', ADMIN_EMAIL, '+250788100001', passwordHash, UserStatus.ACTIVE],
    );
    adminUserId = inserted[0].id as string;
  }

  const membership = await manager.query(
    `SELECT id FROM company_members WHERE "userId" = $1 AND "companyId" = $2 LIMIT 1`,
    [adminUserId, companyId],
  );

  if (membership.length === 0) {
    await manager.query(
      `INSERT INTO company_members ("userId", "companyId", role, status, "joinedAt")
       VALUES ($1, $2, $3, $4, now())`,
      [adminUserId, companyId, UserRole.COMPANY_ADMIN, MembershipStatus.ACTIVE],
    );
  } else {
    await manager.query(
      `UPDATE company_members
       SET role = $1, status = $2, "updatedAt" = now()
       WHERE id = $3`,
      [UserRole.COMPANY_ADMIN, MembershipStatus.ACTIVE, membership[0].id],
    );
  }

  return adminUserId;
}

async function runSeed(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
    entities,
    synchronize: false,
  });

  await dataSource.initialize();
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);

  try {
    const tables = await dataSource.query(
      `SELECT to_regclass('public.users') AS users, to_regclass('public.companies') AS companies`,
    );
    if (!tables[0]?.users || !tables[0]?.companies) {
      throw new Error(
        'Schema missing (users/companies). Run migrations before seeding.',
      );
    }

    const existingCompany = await dataSource.query(
      `SELECT id FROM companies WHERE slug = $1 LIMIT 1`,
      [COMPANY_SLUG],
    );

    if (existingCompany.length > 0) {
      const companyId = existingCompany[0].id as string;
      await dataSource.transaction(async (manager) => {
        await ensureAdmin(manager, passwordHash, companyId);
      });
      console.log('Seed refresh: company already exists; admin ensured.');
      console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
      return;
    }

    await dataSource.transaction(async (manager) => {
      const company = await manager.query(
        `INSERT INTO companies (name, slug, email, phone, address, timezone, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          'Virunga Transport Ltd',
          COMPANY_SLUG,
          'info@virunga.rw',
          '+250788200000',
          'KG 9 Ave, Kacyiru, Kigali',
          'Africa/Kigali',
          'RWF',
        ],
      );
      const companyId = company[0].id as string;

      await ensureAdmin(manager, passwordHash, companyId);

      await manager.query(
        `INSERT INTO company_onboarding ("companyId", "companyProfileCompleted", "operationalSettingsCompleted", "fleetAdded", "teamAdded", "completedAt")
         VALUES ($1, true, true, true, true, now())`,
        [companyId],
      );

      await manager.query(
        `INSERT INTO pricing_rules ("companyId", "firstKilometerPrice", "additionalKilometerPrice", currency, "effectiveFrom", active)
         VALUES ($1, '500', '400', 'RWF', now(), true)`,
        [companyId],
      );

      const employees = [
        { name: 'Claudine Uwase', phone: '+250788300001', dept: 'Finance' },
        { name: 'Emmanuel Habimana', phone: '+250788300002', dept: 'Operations' },
        { name: 'Grace Ingabire', phone: '+250788300003', dept: 'HR' },
        { name: 'Patrick Nshimiyimana', phone: '+250788300004', dept: 'Logistics' },
      ];

      for (const employee of employees) {
        await manager.query(
          `INSERT INTO employees ("companyId", "fullName", phone, department, "canRequestTransport", status)
           VALUES ($1, $2, $3, $4, true, $5)`,
          [companyId, employee.name, employee.phone, employee.dept, EmployeeStatus.ACTIVE],
        );
      }

      const riderProfiles = [
        { firstName: 'Eric', lastName: 'Nzayisenga', phone: '+250788400001' },
        { firstName: 'Alice', lastName: 'Mutesi', phone: '+250788400002' },
        { firstName: 'Fabrice', lastName: 'Habyarimana', phone: '+250788400003' },
      ];

      const riderIds: string[] = [];
      for (const rider of riderProfiles) {
        const user = await manager.query(
          `INSERT INTO users ("firstName", "lastName", phone, "passwordHash", status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [rider.firstName, rider.lastName, rider.phone, passwordHash, UserStatus.ACTIVE],
        );
        const userId = user[0].id as string;

        await manager.query(
          `INSERT INTO company_members ("userId", "companyId", role, status, "joinedAt")
           VALUES ($1, $2, $3, $4, now())`,
          [userId, companyId, UserRole.RIDER, MembershipStatus.ACTIVE],
        );

        const riderRow = await manager.query(
          `INSERT INTO riders ("companyId", "userId", phone, status, "availabilityStatus")
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            companyId,
            userId,
            rider.phone,
            RiderStatus.ACTIVE,
            RiderAvailabilityStatus.OFFLINE,
          ],
        );
        riderIds.push(riderRow[0].id as string);
      }

      const plates = ['RAE 428C', 'RAD 103B', 'RAG 551D'];
      const motorcycleIds: string[] = [];
      for (let i = 0; i < plates.length; i += 1) {
        const moto = await manager.query(
          `INSERT INTO motorcycles ("companyId", "plateNumber", "internalCode", brand, model, year, color, status, "trackingStatus")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            companyId,
            plates[i],
            `VT-0${i + 1}`,
            'TVS',
            'Apache 160',
            2023,
            'Black',
            MotorcycleStatus.ACTIVE,
            MotorcycleTrackingStatus.OFFLINE,
          ],
        );
        motorcycleIds.push(moto[0].id as string);
      }

      for (let i = 0; i < riderIds.length; i += 1) {
        await manager.query(
          `INSERT INTO rider_motorcycle_assignments ("companyId", "riderId", "motorcycleId", "assignedById", "assignedAt", active)
           VALUES ($1, $2, $3, (SELECT id FROM users WHERE email = $4 LIMIT 1), now(), true)`,
          [companyId, riderIds[i], motorcycleIds[i], ADMIN_EMAIL],
        );
      }

      const locs = [
        KIGALI_LOCATIONS.kimironko,
        KIGALI_LOCATIONS.kacyiru,
        KIGALI_LOCATIONS.remera,
      ];

      for (let i = 0; i < motorcycleIds.length; i += 1) {
        const loc = locs[i];
        await manager.query(
          `INSERT INTO motorcycle_current_locations ("motorcycleId", "companyId", position, latitude, longitude, source, "recordedAt")
           VALUES ($1, $2, ST_GeogFromText($3), $4, $5, 'RIDER_APP', now())`,
          [motorcycleIds[i], companyId, toPointWkt(loc), loc.lat, loc.lng],
        );

        await manager.query(
          `INSERT INTO gps_devices ("companyId", "motorcycleId", provider, "externalDeviceId", status, "lastSeenAt")
           VALUES ($1, $2, 'mock', $3, 'ACTIVE', now())`,
          [companyId, motorcycleIds[i], `MOCK-GPS-${i + 1}`],
        );
      }

      console.log('Seed completed: Virunga Transport Ltd with Rwandan staff and Kigali fleet.');
      console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    });
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
