import { DataSource } from 'typeorm';
import dataSource from '../config/typeorm.datasource';

async function run(): Promise<void> {
  const ds: DataSource = await dataSource.initialize();
  try {
    const executed = await ds.runMigrations();
    // eslint-disable-next-line no-console
    console.log(`Ran ${executed.length} migration(s).`);
  } finally {
    await ds.destroy();
  }
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
