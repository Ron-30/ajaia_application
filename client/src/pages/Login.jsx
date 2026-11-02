import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { DocLogo } from '../components/Icons.jsx';

const DEMO = [
  { email: 'alice@demo.com', name: 'Alice' },
  { email: 'bob@demo.com', name: 'Bob' },
  { email: 'carol@demo.com', name: 'Carol' },
];

export default function Login() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e, override) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const creds = override || form;
      const data =
        mode === 'register' && !override
          ? await api.register(creds.name, creds.email, creds.password)
          : await api.login(creds.email, creds.password);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <DocLogo size={44} />
          <span>AJAIA Docs</span>
        </div>
        <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted">{mode === 'login' ? 'to continue to AJAIA Docs' : 'to start writing and sharing documents'}</p>

        {mode === 'register' && (
          <label className="field">
            <span>Full name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="auth-actions">
          <button type="button" className="btn-text" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create account' : 'I already have an account'}
          </button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        </div>

        <div className="demo-box">
          <div className="demo-title">Demo accounts — password <code>demo1234</code></div>
          <div className="demo-buttons">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => submit(null, { email: d.email, password: 'demo1234' })}
              >
                Sign in as {d.name}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
