/**
 * Auth context — provides user state, login, register, and logout
 * across the component tree.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import apiClient from "@/api/client";
import type { LoginFormData, RegisterFormData, TokenResponse, User } from "@/schemas/auth";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Bootstrap: check for existing token on mount ──────────────────

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiClient
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("access_token");
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Actions ───────────────────────────────────────────────────────

  const login = useCallback(async (data: LoginFormData) => {
    const res = await apiClient.post<TokenResponse>("/auth/login", data);
    localStorage.setItem("access_token", res.data.access_token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (data: RegisterFormData) => {
    const res = await apiClient.post<TokenResponse>("/auth/register", {
      email: data.email,
      full_name: data.full_name,
      password: data.password,
    });
    localStorage.setItem("access_token", res.data.access_token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Best-effort — always clear local state
    }
    localStorage.removeItem("access_token");
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
