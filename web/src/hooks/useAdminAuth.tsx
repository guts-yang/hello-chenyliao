import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminFetch, AdminApiError } from '@/lib/adminApi';
import type { AdminUser } from '@/types';

interface AdminAuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await adminFetch<{ authenticated: boolean; user?: AdminUser }>('/api/admin/session');
      setUser(session.authenticated && session.user ? session.user : null);
      setError('');
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setError('');
    try {
      await adminFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await refresh();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    await adminFetch('/api/admin/logout', { method: 'POST' });
    setUser(null);
    onUnauthorized();
  }, [onUnauthorized]);

  const value = useMemo(
    () => ({ user, loading, error, refresh, login, logout }),
    [user, loading, error, refresh, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
