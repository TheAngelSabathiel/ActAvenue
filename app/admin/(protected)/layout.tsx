import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, hasAnyAccess } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ScannerGuard } from "@/components/admin/scanner-guard";
import { AdminAccessProvider, type AdminAccess } from "@/components/admin/access-context";

type NavItem = { href: string; label: string };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/productions", label: "Productions" },
  { href: "/admin/plays", label: "Plays" },
  { href: "/admin/actors", label: "Cast and Crew" },
  { href: "/admin/promo-codes", label: "Promo codes" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/new-reservation", label: "New reservation" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/scan", label: "Scan" },
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
        { href: "/admin/reservations", label: "Reservations" },
        ...(isManager ? [{ href: "/admin/productions", label: "My productions" }] : []),
        ...(isManager ? [{ href: "/admin/promo-codes", label: "Promo codes" }] : []),
        { href: "/admin/sales", label: "Sales" },
        { href: "/admin/new-reservation", label: "New reservation" },
        { href: "/admin/checkin", label: "Check-in" },
        { href: "/admin/scan", label: "Scan" },
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
      <div className="min-h-screen bg-white">
        <header className="bg-black text-white sticky top-0 z-40">
          <nav className="aa-container !max-w-6xl py-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="font-black tracking-[0.12em] mr-4 shrink-0">{heading}</span>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="aa-nav-link shrink-0 whitespace-nowrap">
                {n.label}
              </Link>
            ))}
            <Link href="/" className="aa-nav-link shrink-0 whitespace-nowrap ml-auto opacity-75">
              View site
            </Link>
          </nav>
        </header>
        <main className="aa-container !max-w-6xl py-6 sm:py-10">
          <ScannerGuard scannerOnly={scannerOnly} />
          {children}
        </main>
      </div>
    </AdminAccessProvider>
  );
}
