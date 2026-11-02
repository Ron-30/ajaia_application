import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { issueSession, clearSession, requireAuth } from '../auth.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export function authRoutes(db, secret) {
  const r = Router();

  // Brute-force protection on credential endpoints only.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
  });

  r.post('/login', limiter, async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password' });
    const { email, password } = parsed.data;
    const { rows } = await db.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]);
    const user = rows[0];
    // Same generic message for unknown email and wrong password (no account enumeration).
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    issueSession(res, user, secret);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  r.post('/register', limiter, async (req, res) => {
    const parsed = registration.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { email, password, name } = parsed.data;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING RETURNING id, email, name`,
      [email, name, hash],
    );
    if (!rows[0]) return res.status(409).json({ error: 'An account with this email already exists' });
    issueSession(res, rows[0], secret);
    res.status(201).json({ user: rows[0] });
  });

  r.post('/logout', (req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  r.get('/me', requireAuth(db, secret), (req, res) => res.json({ user: req.user }));

  return r;
}
