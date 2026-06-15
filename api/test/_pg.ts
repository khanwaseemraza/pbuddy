// Test helper: boot a real, throwaway Postgres via embedded-postgres and apply
// the project migrations. Gives integration tests a full Postgres (triggers,
// generated columns, row locks) with no Docker or local install. If DATABASE_URL
// is already set, we use that instead and skip booting.
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'db', 'migrations');

export interface TestPg {
  connectionString: string;
  stop: () => Promise<void>;
}

async function applyMigrations(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

export async function startTestPg(): Promise<TestPg> {
  // Respect an externally provided database (e.g. CI service container).
  if (process.env.DATABASE_URL) {
    await applyMigrations(process.env.DATABASE_URL);
    return { connectionString: process.env.DATABASE_URL, stop: async () => {} };
  }

  const dataDir = mkdtempSync(join(tmpdir(), 'pbuddy-pg-'));
  const port = 54329;
  const epg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'pbuddy',
    password: 'pbuddy',
    port,
    persistent: false,
  });
  await epg.initialise();
  await epg.start();
  await epg.createDatabase('pbuddy');

  const connectionString = `postgres://pbuddy:pbuddy@localhost:${port}/pbuddy`;
  await applyMigrations(connectionString);

  return {
    connectionString,
    stop: async () => {
      await epg.stop();
    },
  };
}
