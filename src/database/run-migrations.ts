import { DataSource } from 'typeorm';
import dataSource from '../config/typeorm.datasource';

async function run(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Migrations path: ${dataSource.options.migrations}`);
  const ds: DataSource = await dataSource.initialize();
  try {
    const executed = await ds.runMigrations();
    // eslint-disable-next-line no-console
    console.log(`Ran ${executed.length} migration(s).`);
    if (executed.length === 0) {
      const tables = await ds.query(`SELECT to_regclass('public.users') AS users`);
      // eslint-disable-next-line no-console
      console.log(`users table present: ${Boolean(tables[0]?.users)}`);
    }
  } finally {
    await ds.destroy();
  }
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
