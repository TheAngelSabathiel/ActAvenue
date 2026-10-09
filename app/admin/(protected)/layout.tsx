import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/productions", label: "Productions" },
  { href: "/admin/actors", label: "Actors" },
  { href: "/admin/promo-codes", label: "Promo codes" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/new-reservation", label: "New reservation" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/account/settings", label: "My profile" },
];

/**
 * Gate for every admin page EXCEPT /admin/login. The login page lives
 * outside this (protected) group on purpose: if this layout wrapped it,
 * signed-out visitors would redirect to /admin/login, which would run this
 * layout again, and loop forever.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin", "organizer"].includes(profile.role)) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-black text-white sticky top-0 z-40">
        <nav className="aa-container !max-w-6xl py-3 flex items-center gap-1 overflow-x-auto">
          <span className="font-black tracking-[0.12em] mr-4 shrink-0">ACT AVENUE ADMIN</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="aa-nav-link shrink-0 whitespace-nowrap">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="aa-nav-link shrink-0 whitespace-nowrap ml-auto opacity-75">
            View site
          </Link>
        </nav>
      </header>
      <main className="aa-container !max-w-6xl py-10">{children}</main>
    </div>
  );
}
