// Thin fetch wrapper. The session lives in an httpOnly cookie, so no token handling here.
async function request(method, url, body, { isForm = false } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/auth/me'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  register: (name, email, password) => request('POST', '/api/auth/register', { name, email, password }),
  logout: () => request('POST', '/api/auth/logout'),

  listDocs: () => request('GET', '/api/documents'),
  createDoc: (data = {}) => request('POST', '/api/documents', data),
  getDoc: (id) => request('GET', `/api/documents/${id}`),
  updateDoc: (id, data) => request('PATCH', `/api/documents/${id}`, data),
  deleteDoc: (id) => request('DELETE', `/api/documents/${id}`),

  listShares: (id) => request('GET', `/api/documents/${id}/shares`),
  share: (id, email, role) => request('POST', `/api/documents/${id}/shares`, { email, role }),
  unshare: (id, userId) => request('DELETE', `/api/documents/${id}/shares/${userId}`),

  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/api/import', form, { isForm: true });
  },
};

export const SUPPORTED_UPLOADS = '.txt,.md,.docx';
