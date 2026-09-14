import type { ReactNode } from "react";
import type { Role } from "../api/types";
import { useAuthContext } from "../context/AuthContext";
import { LoadingState } from "./LoadingState";

const rank: Record<Role, number> = { USER: 1, MODERATOR: 2, ADMIN: 3 };

export function RoleGuard({ minRole, children, fallback }: { minRole: Role; children: ReactNode; fallback?: ReactNode }) {
  const { user, isLoading } = useAuthContext();
  if (isLoading) return <LoadingState />;
  if (!user || rank[user.role] < rank[minRole]) return fallback ?? <div className="empty-state">Nuk ke qasje në këtë faqe.</div>;
  return <>{children}</>;
}
