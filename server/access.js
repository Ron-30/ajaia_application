// Central authorization rule: what is the current user's role on a document?
// Returns { doc, role } with role 'owner' | 'editor' | 'viewer', or null when the user
// has no access. Routes respond 404 for null so outsiders can't probe which IDs exist.
export async function getAccess(db, docId, userId) {
  const id = Number(docId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { rows } = await db.query(
    `SELECT d.*, u.name AS owner_name, u.email AS owner_email, s.role AS share_role
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $2
      WHERE d.id = $1`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) return null;
  const role = row.owner_id === userId ? 'owner' : row.share_role;
  if (!role) return null;
  const { share_role, ...doc } = row;
  return { doc, role };
}

export const canEdit = (role) => role === 'owner' || role === 'editor';
