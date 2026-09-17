import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AdminUser {
  id: string;
  email: string;
  role: 'admin';
  full_name: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const ADMIN_TOKEN_KEY = 'rubicon_admin_token';
const API = '/api';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) { setAdmin(null); setLoading(false); return; }
    try {
      const res = await fetch(`${API}/admin/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Invalid session');
      const data = await res.json();
      setAdmin(data.user);
    } catch {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Admin login failed');
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setAdmin(data.user);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}