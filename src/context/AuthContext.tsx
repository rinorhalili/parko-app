import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth as useAuthState } from "../hooks/useAuth";
import type { User } from "../api/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthState();
  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: Boolean(user) }),
    [isLoading, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuthContext must be used inside AuthProvider");
  return value;
}
