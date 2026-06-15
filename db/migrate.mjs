// Minimal forward-only migration runner. Applies db/migrations/*.sql in order,
// tracking applied files in a schema_migrations table. Idempotent.
//
//   DATABASE_URL=postgres://... node db/migrate.mjs
//
// Uses the `pg` dependency from the api workspace.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );`);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rowCount } = await client.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rowCount > 0) {
      console.log(`= skip ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`> applying ${file}`);
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  console.log('migrations complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
