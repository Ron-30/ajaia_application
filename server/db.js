// Database layer: one `query(sql, params)` API over two engines.
//  - Production (DATABASE_URL set): real Postgres via `pg` connection pool.
//  - Local dev / tests: PGlite, an in-process Postgres (WASM) — no install needed.
// Both accept the same SQL and $1-style parameters, so the rest of the app is engine-agnostic.
import bcrypt from 'bcryptjs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Untitled document',
  content_html TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE TABLE IF NOT EXISTS document_shares (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
`;

export const DEMO_USERS = [
  { email: 'alice@demo.com', name: 'Alice Johnson' },
  { email: 'bob@demo.com', name: 'Bob Smith' },
  { email: 'carol@demo.com', name: 'Carol Diaz' },
];
export const DEMO_PASSWORD = 'demo1234';

/**
 * Create a database handle.
 * @param {{ url?: string, dataDir?: string }} opts
 *   url     – Postgres connection string (production)
 *   dataDir – PGlite directory; 'memory://' for an ephemeral in-memory DB (tests)
 */
export async function createDb({ url, dataDir } = {}) {
  let query, close;

  if (url) {
    const { default: pg } = await import('pg');
    // Render's *internal* hostname (e.g. "dpg-abc123-a") is a private-network name without dots
    // and doesn't use TLS; public hostnames (with dots) require TLS. localhost has no dots either.
    const host = new URL(url).hostname;
    const pool = new pg.Pool({
      connectionString: url,
      ssl: host.includes('.') ? { rejectUnauthorized: false } : false,
      max: 5,
    });
    query = (sql, params = []) => pool.query(sql, params);
    close = () => pool.end();
    await pool.query(SCHEMA);
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = dataDir || './.data/pglite';
    if (!dir.startsWith('memory://')) {
      const fs = await import('node:fs');
      fs.mkdirSync(dir, { recursive: true });
    }
    const lite = new PGlite(dir);
    query = (sql, params = []) => lite.query(sql, params);
    close = () => lite.close();
    await lite.exec(SCHEMA);
  }

  const db = { query, close };
  await seedDemoUsers(db);
  return db;
}

async function seedDemoUsers(db) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    await db.query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.name, hash],
    );
  }
}
