import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Icon } from './Icons.jsx';

export default function ShareDialog({ docId, title, isOwner, onClose }) {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.listShares(docId).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [docId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.share(docId, email, role);
      setEmail('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(s, newRole) {
    try {
      await api.share(docId, s.email, newRole);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(s) {
    try {
      await api.unshare(docId, s.user_id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="share-title">Share “{title}”</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        {isOwner ? (
          <form className="share-form" onSubmit={add}>
            <input
              type="email"
              placeholder="Add people by email, e.g. bob@demo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Permission">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn-primary" disabled={busy}>Share</button>
          </form>
        ) : (
          <p className="muted">Only the owner can change who has access.</p>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}

        <h3 className="people-title">People with access</h3>
        {!data ? (
          <div className="center"><div className="spinner" /></div>
        ) : (
          <ul className="people">
            <li>
              <Avatar name={data.owner.name} />
              <div className="person">
                <div>{data.owner.name}</div>
                <div className="muted small">{data.owner.email}</div>
              </div>
              <span className="muted">Owner</span>
            </li>
            {data.shares.map((s) => (
              <li key={s.user_id}>
                <Avatar name={s.name} />
                <div className="person">
                  <div>{s.name}</div>
                  <div className="muted small">{s.email}</div>
                </div>
                {isOwner ? (
                  <>
                    <select value={s.role} onChange={(e) => changeRole(s, e.target.value)} aria-label={`Permission for ${s.name}`}>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="icon-btn" onClick={() => remove(s)} aria-label={`Remove ${s.name}`} title="Remove access">
                      <Icon name="close" size={18} />
                    </button>
                  </>
                ) : (
                  <span className="muted">{s.role === 'editor' ? 'Editor' : 'Viewer'}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-foot">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
