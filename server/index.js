// Entry point: connect to the database, build the app, start listening.
import crypto from 'node:crypto';
import { createDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error('JWT_SECRET must be set in production');
    process.exit(1);
  }
  // Dev convenience: random per-process secret (sessions reset when the server restarts).
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

const db = await createDb({ url: process.env.DATABASE_URL });
const app = createApp({ db, jwtSecret });

const server = app.listen(PORT, () => {
  console.log(`AJAIA Docs listening on http://localhost:${PORT} (${process.env.DATABASE_URL ? 'Postgres' : 'PGlite local'} database)`);
});

const shutdown = () => server.close(async () => { await db.close(); process.exit(0); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
