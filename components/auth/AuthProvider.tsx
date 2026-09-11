"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import type { AuthUser } from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const defaultUser: AuthUser = {
  id: "usr-hr-admin",
  email: "admin@hotel.com",
  name: "HR Administrator",
  role: "admin",
  initials: "HA",
  isSuperAdmin: true,
};

const AuthContext = createContext<AuthContextValue>({
  user: defaultUser,
  loading: false,
  login: async () => defaultUser,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(defaultUser);
  const [loading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setUser(defaultUser);
    return defaultUser;
  }, []);

  const logout = useCallback(() => {
    setUser(defaultUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}
