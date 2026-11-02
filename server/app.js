// Express application factory. Kept separate from index.js so tests can build an app
// against an in-memory database without opening a network port.
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { uploadRoutes } from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');

export function createApp({ db, jwtSecret }) {
  if (!jwtSecret) throw new Error('JWT secret is required');
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render terminates TLS at its proxy; needed for rate limiting & secure cookies.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  const auth = requireAuth(db, jwtSecret);
  app.use('/api/auth', authRoutes(db, jwtSecret));
  app.use('/api/import', auth, uploadRoutes(db));
  app.use('/api/documents', auth, documentRoutes(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app (production). Unknown non-API paths fall back to index.html
  // so client-side routes like /doc/12 work on refresh.
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  }

  // Central error handler: log details server-side, never leak stack traces to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Document is too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
