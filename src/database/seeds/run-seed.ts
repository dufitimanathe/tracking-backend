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

const KIGALI_LOCATIONS = {
  kimironko: { lat: -1.9595, lng: 30.1228, label: 'Kimironko Market' },
  kacyiru: { lat: -1.9369, lng: 30.0827, label: 'Kacyiru' },
  remera: { lat: -1.9495, lng: 30.1115, label: 'Remera' },
  nyabugogo: { lat: -1.9392, lng: 30.0444, label: 'Nyabugogo' },
  kigaliHeights: { lat: -1.9506, lng: 30.0912, label: 'Kigali Heights' },
};

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
  const passwordHash = await argon2.hash('Password123!');

  try {
    const existing = await dataSource.query(
      `SELECT id FROM companies WHERE slug = $1 LIMIT 1`,
      ['virunga-transport-ltd'],
    );
    if (existing.length > 0) {
      console.log('Seed already applied (Virunga Transport Ltd exists). Skipping.');
      return;
    }

    await dataSource.transaction(async (manager) => {
      const adminUser = await manager.query(
        `INSERT INTO users ("firstName", "lastName", email, phone, "passwordHash", status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ['Jean Baptiste', 'Mukamana', 'admin@virunga.rw', '+250788100001', passwordHash, UserStatus.ACTIVE],
      );
      const adminUserId = adminUser[0].id as string;

      const company = await manager.query(
        `INSERT INTO companies (name, slug, email, phone, address, timezone, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          'Virunga Transport Ltd',
          'virunga-transport-ltd',
          'info@virunga.rw',
          '+250788200000',
          'KG 9 Ave, Kacyiru, Kigali',
          'Africa/Kigali',
          'RWF',
        ],
      );
      const companyId = company[0].id as string;

      await manager.query(
        `INSERT INTO company_onboarding ("companyId", "companyProfileCompleted", "operationalSettingsCompleted", "fleetAdded", "teamAdded", "completedAt")
         VALUES ($1, true, true, true, true, now())`,
        [companyId],
      );

      await manager.query(
        `INSERT INTO company_members ("userId", "companyId", role, status, "joinedAt")
         VALUES ($1, $2, $3, $4, now())`,
        [adminUserId, companyId, UserRole.COMPANY_ADMIN, MembershipStatus.ACTIVE],
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

        const remera = KIGALI_LOCATIONS.remera;
        const riderRow = await manager.query(
          `INSERT INTO riders ("companyId", "userId", phone, status, "availabilityStatus", "currentLatitude", "currentLongitude", position, "locationUpdatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeogFromText($8), now()) RETURNING id`,
          [
            companyId,
            userId,
            rider.phone,
            RiderStatus.ACTIVE,
            RiderAvailabilityStatus.AVAILABLE,
            String(remera.lat),
            String(remera.lng),
            toPointWkt(remera),
          ],
        );
        riderIds.push(riderRow[0].id as string);
      }

      const motorcycles = [
        { plate: 'RAD 101 A', brand: 'TVS', model: 'HLX 125', code: 'VT-M01' },
        { plate: 'RAD 102 B', brand: 'Bajaj', model: 'Boxer 150', code: 'VT-M02' },
        { plate: 'RAD 103 C', brand: 'Honda', model: 'Ace CB125', code: 'VT-M03' },
      ];

      const motorcycleIds: string[] = [];
      for (const moto of motorcycles) {
        const row = await manager.query(
          `INSERT INTO motorcycles ("companyId", "plateNumber", "internalCode", brand, model, status, "trackingStatus")
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            companyId,
            moto.plate,
            moto.code,
            moto.brand,
            moto.model,
            MotorcycleStatus.ACTIVE,
            MotorcycleTrackingStatus.PARKED,
          ],
        );
        motorcycleIds.push(row[0].id as string);
      }

      for (let i = 0; i < riderIds.length; i += 1) {
        await manager.query(
          `INSERT INTO rider_motorcycle_assignments ("companyId", "riderId", "motorcycleId", "assignedById", "assignedAt", active)
           VALUES ($1, $2, $3, $4, now(), true)`,
          [companyId, riderIds[i], motorcycleIds[i], adminUserId],
        );

        const loc = [KIGALI_LOCATIONS.kimironko, KIGALI_LOCATIONS.kacyiru, KIGALI_LOCATIONS.nyabugogo][i];
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
      console.log('Admin login: admin@virunga.rw / Password123!');
    });
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
