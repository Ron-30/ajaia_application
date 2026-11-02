import { useState } from 'react';
import { useAuth } from '../App.jsx';
import { Avatar } from './Icons.jsx';

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="user-menu">
      <button className="avatar-btn" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}>
        <Avatar name={user.name} />
      </button>
      {open && (
        <>
          <div className="backdrop-clear" onClick={() => setOpen(false)} />
          <div className="menu-card">
            <Avatar name={user.name} size={56} />
            <div className="menu-name">{user.name}</div>
            <div className="muted">{user.email}</div>
            <button className="btn-outline" onClick={logout}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
