import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3500/api/v1";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3500";

const ACCESS_KEY = "sr_access_token";
const REFRESH_KEY = "sr_refresh_token";
const USER_KEY = "sr_user";

export function getTokens() {
  return {
    access:
      typeof window !== "undefined"
        ? window.localStorage.getItem(ACCESS_KEY)
        : null,
    refresh:
      typeof window !== "undefined"
        ? window.localStorage.getItem(REFRESH_KEY)
        : null,
  };
}

export function setTokens(access: string, refresh: string) {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function setStoredUser(user: unknown) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser<T = AuthUser>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export interface AuthUser {
  userId: string;
  role: string;
  phone?: string;
  email?: string;
  name?: string;
}

export interface Envelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getTokens();
  if (!refresh) return null;
  try {
    const res = await axios.post<
      Envelope<{ accessToken: string; refreshToken: string }>
    >(`${API_URL}/auth/token/refresh`, { refreshToken: refresh });
    const { accessToken, refreshToken } = res.data.data;
    setTokens(accessToken, refreshToken);
    return accessToken;
  } catch {
    clearSession();
    return null;
  }
}

interface ApiClient extends AxiosInstance {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

export const api = axios.create({ baseURL: API_URL }) as ApiClient;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const envelope = response.data as Envelope<unknown> | unknown;
    return typeof envelope === "object" &&
      envelope !== null &&
      "data" in envelope
      ? (envelope as Envelope<unknown>).data
      : response.data;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      original.url !== "/auth/token/refresh"
    ) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken();
      try {
        const token = await refreshPromise;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } finally {
        refreshPromise = null;
      }
    }

    const body = error.response?.data;
    throw new ApiError(
      status ?? 0,
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : (body?.message ?? error.message),
      body?.code ?? body?.error ?? "",
    );
  },
);

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
