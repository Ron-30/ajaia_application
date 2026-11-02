import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '../api.js';
import { DocLogo, Icon } from '../components/Icons.jsx';
import { UserMenu } from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import ShareDialog from '../components/ShareDialog.jsx';

const AUTOSAVE_MS = 800;

export default function Editor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved'); // 'saved' | 'unsaved' | 'saving' | 'error'
  const [sharing, setSharing] = useState(false);
  const pending = useRef(null); // latest unsaved HTML
  const timer = useRef(null);

  const canEdit = doc && (doc.role === 'owner' || doc.role === 'editor');
  const isOwner = doc?.role === 'owner';

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const html = pending.current;
    pending.current = null;
    setStatus('saving');
    try {
      await api.updateDoc(id, { content_html: html });
      setStatus(pending.current === null ? 'saved' : 'unsaved');
    } catch (e) {
      pending.current ??= html; // keep for retry
      setStatus('error');
      setError(e.message);
    }
  }, [id]);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder: 'Start typing…' })],
    content: '',
    editable: false,
    onUpdate: ({ editor: ed }) => {
      pending.current = ed.getHTML();
      setStatus('unsaved');
      clearTimeout(timer.current);
      timer.current = setTimeout(save, AUTOSAVE_MS);
    },
  }, [save]);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError('');
    api.getDoc(id)
      .then(({ document }) => {
        if (cancelled) return;
        setDoc(document);
        setTitle(document.title);
        document.title && (window.document.title = `${document.title} - AJAIA Docs`);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  // Push loaded content + permissions into the editor.
  useEffect(() => {
    if (!editor || !doc) return;
    editor.commands.setContent(doc.content_html || '', false);
    editor.setEditable(doc.role === 'owner' || doc.role === 'editor');
  }, [editor, doc]);

  // Flush unsaved changes when leaving the page or closing the tab.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (pending.current === null) return;
      fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_html: pending.current }),
      });
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      save();
      window.document.title = 'AJAIA Docs';
    };
  }, [id, save]);

  async function commitTitle() {
    const t = title.trim();
    if (!t) return setTitle(doc.title);
    if (t === doc.title) return;
    try {
      setStatus('saving');
      await api.updateDoc(id, { title: t });
      setDoc({ ...doc, title: t });
      window.document.title = `${t} - AJAIA Docs`;
      setStatus('saved');
    } catch (e) {
      setError(e.message);
      setTitle(doc.title);
      setStatus('error');
    }
  }

  if (error && !doc) {
    return (
      <div className="center-page">
        <h2>{error}</h2>
        <p className="muted">It may have been deleted, or you don't have access.</p>
        <Link to="/" className="btn-primary">Back to documents</Link>
      </div>
    );
  }

  const statusText = { saved: 'All changes saved', unsaved: 'Unsaved changes', saving: 'Saving…', error: 'Couldn’t save — retrying on next edit' }[status];

  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link to="/" className="editor-logo" title="Docs home"><DocLogo size={40} /></Link>
        <div className="editor-meta">
          <div className="title-row">
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              disabled={!isOwner}
              maxLength={200}
              aria-label="Document title"
              title={isOwner ? 'Rename' : 'Only the owner can rename'}
            />
            {doc && canEdit && (
              <span className={`save-status ${status}`} aria-live="polite">
                <Icon name="cloud" size={16} /> {statusText}
              </span>
            )}
          </div>
          <div className="meta-row muted small">
            {doc && (isOwner ? 'Owned by you' : `Owned by ${doc.owner_name} · shared with you as ${doc.role}`)}
          </div>
        </div>
        <div className="editor-actions">
          {doc && (
            <button className="btn-share" onClick={() => setSharing(true)}>
              <Icon name="share" size={18} /> Share
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      <Toolbar editor={editor} disabled={!canEdit} />

      {doc && !canEdit && (
        <div className="viewer-banner"><Icon name="eye" size={18} /> You have view-only access. Ask {doc.owner_name} for edit access.</div>
      )}
      {error && doc && <div className="form-error floating" role="alert">{error}</div>}

      <div className="canvas">
        <div className="page">
          {!doc ? <div className="center"><div className="spinner" /></div> : <EditorContent editor={editor} />}
        </div>
      </div>

      {sharing && doc && <ShareDialog docId={doc.id} title={doc.title} isOwner={isOwner} onClose={() => setSharing(false)} />}
    </div>
  );
}
