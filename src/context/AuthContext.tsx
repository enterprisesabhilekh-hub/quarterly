import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AuthUser,
  Department,
  District,
  FiscalYear,
  GovernmentOffice,
  ImplementationIndicator,
  LocalLevel,
  Ministry,
  Province,
  ReportingPeriod,
  Role,
} from '../types/index.ts';

export interface MasterData {
  provinces: Province[];
  districts: District[];
  local_levels: LocalLevel[];
  ministries: Ministry[];
  departments: Department[];
  fiscal_years: FiscalYear[];
  reporting_periods: ReportingPeriod[];
  indicators: ImplementationIndicator[];
  roles: Role[];
  offices: GovernmentOffice[];
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  master: MasterData | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshMaster: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  apiDownload: (url: string, filename: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Store auth token strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(false);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
      const activeToken = overrideToken ?? token;
      const headers = new Headers(options.headers || {});
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      return (await res.json()) as T;
    },
    [token]
  );

  const apiDownload = useCallback(
    async (url: string, filename: string) => {
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    },
    [token]
  );

  const loadMaster = useCallback(
    async (activeToken: string) => {
      const data = await apiFetch<MasterData>('/api/master/all', {}, activeToken);
      setMaster(data);
    },
    [apiFetch]
  );

  const refreshMaster = useCallback(async () => {
    if (!token) return;
    await loadMaster(token);
  }, [token, loadMaster]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Login failed');
        }
        setToken(data.token);
        setUser(data.user);
        if (!data.user.must_change_password) {
          await loadMaster(data.token);
        }
      } finally {
        setLoading(false);
      }
    },
    [loadMaster]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setUser((currentUser) => (currentUser ? { ...currentUser, must_change_password: false } : currentUser));
      if (token) {
        await loadMaster(token);
      }
    },
    [apiFetch, token, loadMaster]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setMaster(null);
  }, []);

  useEffect(() => {
    // No auto-login from storage; explicit authenticated session only
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        master,
        loading,
        login,
        changePassword,
        logout,
        refreshMaster,
        apiFetch: (url, options) => apiFetch(url, options),
        apiDownload,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
