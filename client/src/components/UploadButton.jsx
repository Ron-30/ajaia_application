import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SUPPORTED_UPLOADS } from '../api.js';
import { Icon } from './Icons.jsx';

/** Upload a .txt / .md / .docx file → creates a new editable document and opens it. */
export default function UploadTile() {
  const input = useRef(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('File is too large (max 5 MB)');
    setBusy(true);
    setError('');
    try {
      const { document } = await api.importFile(file);
      navigate(`/doc/${document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="template">
      <button className="template-thumb upload-thumb" onClick={() => input.current.click()} disabled={busy}>
        {busy ? <div className="spinner" /> : <Icon name="upload" size={40} />}
      </button>
      <div className="template-name">Import a file</div>
      <div className="template-hint">.txt, .md or .docx · max 5 MB</div>
      {error && <div className="form-error small" role="alert">{error}</div>}
      <input ref={input} type="file" accept={SUPPORTED_UPLOADS} hidden onChange={onFile} />
    </div>
  );
}
