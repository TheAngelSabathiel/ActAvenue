"use client";

import { createContext, useContext } from "react";

export type StaffRole = "manager" | "foh";
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
    return level === "foh" ? true : a.role === "manager";
  };
  return { ...access, can };
}
