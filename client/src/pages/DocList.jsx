import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { DocLogo, Icon } from '../components/Icons.jsx';
import { UserMenu } from '../components/TopBar.jsx';
import UploadTile from '../components/UploadButton.jsx';

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function DocList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = () => api.listDocs().then((d) => setDocs(d.documents)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function createBlank() {
    try {
      const { document } = await api.createDoc();
      navigate(`/doc/${document.id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    try {
      await api.deleteDoc(doc.id);
      setDocs((all) => all.filter((d) => d.id !== doc.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const visible = useMemo(() => {
    if (!docs) return [];
    return docs
      .filter((d) => (filter === 'owned' ? d.role === 'owner' : filter === 'shared' ? d.role !== 'owner' : true))
      .filter((d) => d.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [docs, filter, search]);

  return (
    <div className="home">
      <header className="home-header">
        <Link to="/" className="brand">
          <DocLogo size={36} />
          <span>Docs</span>
        </Link>
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
        </div>
        <UserMenu />
      </header>

      <section className="templates">
        <div className="templates-inner">
          <h2>Start a new document</h2>
          <div className="template-row">
            <div className="template">
              <button className="template-thumb blank-thumb" onClick={createBlank} aria-label="Blank document">
                <Icon name="plus" size={56} />
              </button>
              <div className="template-name">Blank document</div>
            </div>
            <UploadTile />
          </div>
        </div>
      </section>

      <main className="doc-list">
        <div className="doc-list-head">
          <h2>Documents</h2>
          <div className="segmented" role="tablist" aria-label="Filter documents">
            {[['all', 'All'], ['owned', 'Owned by me'], ['shared', 'Shared with me']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        {!docs && !error && <div className="center"><div className="spinner" /></div>}
        {docs && visible.length === 0 && (
          <div className="empty">
            {filter === 'shared' ? 'Nothing has been shared with you yet.' : search ? 'No documents match your search.' : 'No documents yet — start one above.'}
          </div>
        )}

        {visible.length > 0 && (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Last modified</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} onClick={() => navigate(`/doc/${d.id}`)}>
                  <td className="doc-name">
                    <Icon name="doc" className="doc-icon" />
                    <span className="doc-title">{d.title}</span>
                    {d.role !== 'owner' && (
                      <span className={`badge badge-${d.role}`} title={`Shared with you as ${d.role}`}>
                        <Icon name="people" size={14} /> {d.role === 'editor' ? 'Can edit' : 'View only'}
                      </span>
                    )}
                  </td>
                  <td className="muted">{d.role === 'owner' ? 'me' : d.owner_name}</td>
                  <td className="muted">{formatDate(d.updated_at)}</td>
                  <td className="row-actions">
                    {d.owner_id === user.id && (
                      <button className="icon-btn" aria-label={`Delete ${d.title}`} title="Delete" onClick={(e) => { e.stopPropagation(); remove(d); }}>
                        <Icon name="trash" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
