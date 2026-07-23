'use client';

/**
 * Lightweight client-side auth state for GadgetHub.
 *
 * Security note: the browser never sees the JWT — it lives in an httpOnly
 * cookie. So "am I logged in?" is answered authoritatively by the server via
 * GET /api/users/me (401 when not signed in). This context just caches that
 * answer so the navbar and page guards stay in sync without every component
 * hitting the API on its own.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { apiGet, apiPost } from './api';

export interface AuthUser {
  email: string;
  fullName: string;
  role: string;
  mfaEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const res = await apiGet('/api/users/me');
    setUser(res.ok ? res.data.user : null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiPost('/api/auth/logout');
    setUser(null);
  }, []);

  // Re-check on every navigation so the nav reflects a fresh login/logout.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
