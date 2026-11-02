// Session handling: a signed JWT stored in an httpOnly cookie.
// httpOnly → page JavaScript can't read it (limits XSS token theft).
// SameSite=Lax → the cookie isn't sent on cross-site POSTs (CSRF mitigation).
// Secure (production) → only sent over HTTPS.
import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'ajaia_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function issueSession(res, user, secret) {
  const token = jwt.sign({ sub: user.id }, secret, { expiresIn: '7d', algorithm: 'HS256' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Express middleware: populates req.user or responds 401. */
export function requireAuth(db, secret) {
  return async (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      const { rows } = await db.query('SELECT id, email, name FROM users WHERE id = $1', [payload.sub]);
      if (!rows[0]) return res.status(401).json({ error: 'Not signed in' });
      req.user = rows[0];
      next();
    } catch {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }
  };
}
