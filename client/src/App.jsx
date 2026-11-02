import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import DocList from './pages/DocList.jsx';
import Editor from './pages/Editor.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking session

  useEffect(() => {
    api.me().then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  if (user === undefined) return <div className="splash"><div className="spinner" /></div>;

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={user ? <DocList /> : <Navigate to="/login" replace />} />
        <Route path="/doc/:id" element={user ? <Editor /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
