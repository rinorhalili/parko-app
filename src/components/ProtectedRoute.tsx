import type { ReactNode } from "react";
import { useAuthContext } from "../context/AuthContext";
import { LoadingState } from "./LoadingState";

export function ProtectedRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) return <LoadingState />;
  if (!isAuthenticated) return fallback ?? <div className="empty-state">Hyr në llogari për të vazhduar.</div>;
  return <>{children}</>;
}
