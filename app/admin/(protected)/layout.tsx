import { redirect } from "next/navigation";
import { getAccess, hasAnyAccess } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/admin-nav";
import { ScannerGuard } from "@/components/admin/scanner-guard";
import { AdminAccessProvider, type AdminAccess } from "@/components/admin/access-context";

type NavItem = { href: string; label: string };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/new-reservation", label: "New reservation" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/scan", label: "Scan" },
  { href: "/admin/checkin-report", label: "Check-in report" },
  { href: "/admin/productions", label: "Productions" },
  { href: "/admin/plays", label: "Plays" },
  { href: "/admin/actors", label: "Cast and Crew" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/promo-codes", label: "Promo codes" },
  { href: "/admin/mailing-list", label: "Mailing list" },
  { href: "/account/settings", label: "My profile" },
];

/**
 * Gate for every admin page EXCEPT /admin/login. The login page lives
 * outside this (protected) group on purpose: if this layout wrapped it,
 * signed-out visitors would redirect to /admin/login, which would run this
 * layout again, and loop forever.
 *
 * Admins see everything. Managers and FOH only see tabs for the productions
 * they are assigned to.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access || !hasAnyAccess(access, "scanner")) redirect("/admin/login");

  const ids = Object.keys(access.assignments);
  let titles = new Map<string, string>();
  if (ids.length) {
    const { data } = await createServiceClient().from("productions").select("id, title").in("id", ids);
    titles = new Map((data ?? []).map((p) => [p.id, p.title]));
  }
  const value: AdminAccess = {
    isAdmin: access.isAdmin,
    assignments: ids
      .map((id) => ({ production_id: id, title: titles.get(id) ?? "Production", role: access.assignments[id] }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };

  const isManager = value.assignments.some((a) => a.role === "manager");
  const scannerOnly = !access.isAdmin && value.assignments.every((a) => a.role === "scanner");
  const nav: NavItem[] = access.isAdmin
    ? ADMIN_NAV
    : scannerOnly
      ? [
          { href: "/admin/scan", label: "Scan" },
          { href: "/account/settings", label: "My profile" },
        ]
      : [
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/reservations", label: "Reservations" },
        { href: "/admin/new-reservation", label: "New reservation" },
        { href: "/admin/sales", label: "Sales" },
        { href: "/admin/checkin", label: "Check-in" },
        { href: "/admin/scan", label: "Scan" },
        ...(isManager ? [{ href: "/admin/checkin-report", label: "Check-in report" }] : []),
        ...(isManager ? [{ href: "/admin/productions", label: "My productions" }] : []),
        ...(isManager ? [{ href: "/admin/promo-codes", label: "Promo codes" }] : []),
        { href: "/account/settings", label: "My profile" },
      ];

  const heading = access.isAdmin
    ? "ACT AVENUE ADMIN"
    : isManager
      ? "ACT AVENUE MANAGER"
      : scannerOnly
        ? "ACT AVENUE SCANNER"
        : "ACT AVENUE FOH";

  return (
    <AdminAccessProvider value={value}>
      <AdminShell heading={heading} items={nav}>
        <main className="aa-container !max-w-6xl py-6 sm:py-10">
          <ScannerGuard scannerOnly={scannerOnly} />
          {children}
        </main>
      </AdminShell>
    </AdminAccessProvider>
  );
}
