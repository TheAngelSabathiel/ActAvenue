import { redirect } from "next/navigation";
import { getAccess } from "@/lib/admin-auth";

/** The admin home is the dashboard. Scanner-only accounts go straight to the scanner. */
export default async function AdminHome() {
  const access = await getAccess();
  const scannerOnly = !!access && !access.isAdmin && Object.values(access.assignments).every((r) => r === "scanner");
  redirect(scannerOnly ? "/admin/scan" : "/admin/dashboard");
}
