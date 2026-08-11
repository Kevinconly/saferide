"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearSession,
  getStoredUser,
  getTokens,
  setStoredUser,
  setTokens,
} from "./api";

export interface WebUser {
  id: string;
  username?: string | null;
  phone: string;
  email?: string | null;
  name?: string | null;
  role: string;
  isVerified: boolean;
  status: string;
  driver?: {
    id: string;
    isVerified: boolean;
    status: string;
  } | null;
}

interface AuthContextValue {
  user: WebUser | null;
  loading: boolean;
  isAdmin: boolean;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  login: (identifier: string, password: string) => Promise<WebUser>;
  signUp: (
    phone: string,
    password: string,
    username?: string,
    email?: string,
    name?: string,
    role?: "PASSENGER" | "DRIVER",
  ) => Promise<WebUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WebUser | null>(() =>
    getStoredUser<WebUser>(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { access } = getTokens();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<WebUser>("/auth/me");
        if (!mounted) return;
        setUser(me);
        setStoredUser(me);
      } catch {
        clearSession();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    // OTP flows are temporarily disabled for development/demo. Return a no-op response.
    // Authentication for login/signup requires password-based credentials. Role-based access remains enforced.
    try {
      // keep a light-touch call for compatibility, but do not rely on OTP behavior
      await Promise.resolve();
      return { sent: false } as { sent: boolean; devCode?: string };
    } catch {
      return { sent: false } as { sent: boolean; devCode?: string };
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{
      user: WebUser;
      tokens: { accessToken: string; refreshToken: string };
    }>("/auth/login", { identifier, password });
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const signUp = useCallback(
    async (
      phone: string,
      password: string,
      username?: string,
      email?: string,
      name?: string,
      role?: "PASSENGER" | "DRIVER",
    ) => {
      const res = await api.post<{
        user: WebUser;
        tokens: { accessToken: string; refreshToken: string };
      }>("/auth/signup", { phone, password, username, email, name, role });
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      setStoredUser(res.user);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      const { refresh } = getTokens();
      if (refresh) await api.post("/auth/logout", { refreshToken: refresh });
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
      requestOtp,
      login,
      signUp,
      logout,
    }),
    [user, loading, requestOtp, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
