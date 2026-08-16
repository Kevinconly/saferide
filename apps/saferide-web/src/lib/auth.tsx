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
  phone: string | null;
  email?: string | null;
  name?: string | null;
  role: string;
  isVerified: boolean;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  status: string;
  driver?: {
    id: string;
    isVerified: boolean;
    status: string;
  } | null;
}

export interface OtpRequestResult {
  sent: boolean;
  mode?: "code" | "auto";
  devCode?: string;
}

export interface EmailOtpVerifyResult {
  success: boolean;
  user: Pick<WebUser, "id" | "email"> & { isEmailVerified: boolean };
  accessToken: string;
  refreshToken: string;
}

export interface UsernameCheckResult {
  available: boolean;
  normalized?: string;
  suggestions?: string[];
}

interface AuthContextValue {
  user: WebUser | null;
  loading: boolean;
  isAdmin: boolean;
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  requestEmailOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<WebUser>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean }>;
  checkUsername: (username: string) => Promise<UsernameCheckResult>;
  login: (identifier: string, password: string) => Promise<WebUser>;
  signUp: (data: {
    email: string;
    password: string;
    phone?: string;
    username?: string;
    name?: string;
    role?: "PASSENGER" | "DRIVER";
  }) => Promise<WebUser>;
  verifyOtp: (phone: string, code?: string) => Promise<WebUser>;
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
    const res = await api.post<OtpRequestResult>("/auth/request-otp", {
      phone,
    });
    return res;
  }, []);

  const requestEmailOtp = useCallback(
    async (email: string) => {
      return api.post<{ success: boolean; message: string }>(
        "/auth/email/request-otp",
        { email },
      );
    },
    [],
  );

  const checkUsername = useCallback(async (username: string) => {
    return api.get<UsernameCheckResult>("/auth/username-available", {
      params: { username },
    });
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return api.post<{ success: boolean; message: string }>(
      "/auth/password/forgot",
      { email },
    );
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      return api.post<{ success: boolean }>("/auth/password/reset", {
        token,
        password,
      });
    },
    [],
  );

  const verifyEmailOtp = useCallback(
    async (email: string, otp: string) => {
      const res = await api.post<EmailOtpVerifyResult>(
        "/auth/email/verify-otp",
        { email, otp },
      );
      setTokens(res.accessToken, res.refreshToken);
      const user: WebUser = {
        id: res.user.id,
        phone: null,
        email: res.user.email,
        isVerified: true,
        isEmailVerified: true,
        status: "ACTIVE",
        role: "PASSENGER",
      };
      const previous = getStoredUser<WebUser>();
      const merged = previous ? { ...previous, ...user } : user;
      setStoredUser(merged);
      setUser(merged);
      return merged;
    },
    [],
  );

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
    async (data: {
      email: string;
      password: string;
      phone?: string;
      username?: string;
      name?: string;
      role?: "PASSENGER" | "DRIVER";
    }) => {
      const res = await api.post<{
        user: WebUser;
        tokens: { accessToken: string; refreshToken: string };
      }>("/auth/signup", data);
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

  const verifyOtp = useCallback(async (phone: string, code?: string) => {
    const res = await api.post<{
      user: WebUser;
      tokens: { accessToken: string; refreshToken: string };
    }>("/auth/verify-otp", { phone, code });
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
      requestOtp,
      requestEmailOtp,
      verifyEmailOtp,
      requestPasswordReset,
      resetPassword,
      checkUsername,
      login,
      signUp,
      verifyOtp,
      logout,
    }),
    [
      user,
      loading,
      requestOtp,
      requestEmailOtp,
      verifyEmailOtp,
      requestPasswordReset,
      resetPassword,
      checkUsername,
      login,
      signUp,
      verifyOtp,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
