"use client";

import { createContext, useContext } from "react";

export type StaffRole = "manager" | "foh" | "scanner";
const RANK: Record<StaffRole, number> = { scanner: 0, foh: 1, manager: 2 };
export interface AdminAccess {
  isAdmin: boolean;
  assignments: { production_id: string; title: string; role: StaffRole }[];
}

const Ctx = createContext<AdminAccess>({ isAdmin: false, assignments: [] });

export function AdminAccessProvider({ value, children }: { value: AdminAccess; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAccess() {
  const access = useContext(Ctx);
  /** Can this person act at this level on a production? Admins always can. */
  const can = (productionId: string | null | undefined, level: StaffRole) => {
    if (access.isAdmin) return true;
    const a = access.assignments.find((x) => x.production_id === productionId);
    if (!a) return false;
    return RANK[a.role] >= RANK[level];
  };
  /** Assigned only as a scanner somewhere, with nothing higher. */
  const scannerOnly = !access.isAdmin && access.assignments.length > 0 && access.assignments.every((a) => a.role === "scanner");
  return { ...access, can, scannerOnly };
}
