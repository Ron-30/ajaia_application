import { Router } from 'express';
import { z } from 'zod';
import { getAccess, canEdit } from '../access.js';
import { cleanHtml } from '../sanitize.js';

const MAX_HTML = 2_000_000; // ~2 MB of HTML per document

const title = z.string().trim().min(1, 'Title cannot be empty').max(200);
const createBody = z.object({
  title: title.optional(),
  content_html: z.string().max(MAX_HTML).optional(),
});
const updateBody = z
  .object({ title: title.optional(), content_html: z.string().max(MAX_HTML).optional() })
  .refine((b) => b.title !== undefined || b.content_html !== undefined, 'Nothing to update');
const shareBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['viewer', 'editor']).default('editor'),
});

const notFound = (res) => res.status(404).json({ error: 'Document not found' });
const forbidden = (res, msg) => res.status(403).json({ error: msg });

export function documentRoutes(db) {
  const r = Router();

  // List: everything I own plus everything shared with me, newest first.
  r.get('/', async (req, res) => {
    const { rows } = await db.query(
      `SELECT d.id, d.title, d.updated_at, d.created_at, d.owner_id,
              u.name AS owner_name, u.email AS owner_email,
              CASE WHEN d.owner_id = $1 THEN 'owner' ELSE s.role END AS role
         FROM documents d
         JOIN users u ON u.id = d.owner_id
         LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $1
        WHERE d.owner_id = $1 OR s.user_id = $1
        ORDER BY d.updated_at DESC`,
      [req.user.id],
    );
    res.json({ documents: rows });
  });

  r.post('/', async (req, res) => {
    const parsed = createBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { rows } = await db.query(
      `INSERT INTO documents (owner_id, title, content_html) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, parsed.data.title ?? 'Untitled document', cleanHtml(parsed.data.content_html ?? '')],
    );
    res.status(201).json({ document: { ...rows[0], role: 'owner', owner_name: req.user.name, owner_email: req.user.email } });
  });

  r.get('/:id', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    res.json({ document: { ...access.doc, role: access.role } });
  });

  r.patch('/:id', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    const parsed = updateBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { title: newTitle, content_html } = parsed.data;
    if (!canEdit(access.role)) return forbidden(res, 'You have view-only access to this document');
    if (newTitle !== undefined && access.role !== 'owner') return forbidden(res, 'Only the owner can rename this document');

    const { rows } = await db.query(
      `UPDATE documents
          SET title = COALESCE($2, title),
              content_html = COALESCE($3, content_html),
              updated_at = now()
        WHERE id = $1
        RETURNING id, title, updated_at`,
      [access.doc.id, newTitle ?? null, content_html === undefined ? null : cleanHtml(content_html)],
    );
    res.json({ document: rows[0] });
  });

  r.delete('/:id', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    if (access.role !== 'owner') return forbidden(res, 'Only the owner can delete this document');
    await db.query('DELETE FROM documents WHERE id = $1', [access.doc.id]);
    res.status(204).end();
  });

  // ---- Sharing ----
  r.get('/:id/shares', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.email, u.name, s.role
         FROM document_shares s JOIN users u ON u.id = s.user_id
        WHERE s.document_id = $1 ORDER BY u.name`,
      [access.doc.id],
    );
    res.json({ owner: { name: access.doc.owner_name, email: access.doc.owner_email }, shares: rows });
  });

  r.post('/:id/shares', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    if (access.role !== 'owner') return forbidden(res, 'Only the owner can share this document');
    const parsed = shareBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address' });
    const { email, role } = parsed.data;
    const { rows } = await db.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: `No user found with email ${email}` });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You already own this document' });
    await db.query(
      `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [access.doc.id, target.id, role],
    );
    res.status(201).json({ share: { user_id: target.id, email: target.email, name: target.name, role } });
  });

  r.delete('/:id/shares/:userId', async (req, res) => {
    const access = await getAccess(db, req.params.id, req.user.id);
    if (!access) return notFound(res);
    if (access.role !== 'owner') return forbidden(res, 'Only the owner can change sharing');
    await db.query('DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2', [
      access.doc.id,
      Number(req.params.userId) || 0,
    ]);
    res.status(204).end();
  });

  return r;
}
