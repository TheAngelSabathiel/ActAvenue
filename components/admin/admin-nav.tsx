"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; group?: string };
const KEY = "aa-admin-sidebar-collapsed";

const ICONS: Record<string, string> = {
  "/admin/dashboard": "bi-speedometer2",
  "/admin/checkin-report": "bi-clipboard-data",
  "/admin/mailing-list": "bi-envelope-paper",
  "/admin/reservations": "bi-ticket-perforated",
  "/admin/organizations": "bi-building",
  "/admin/productions": "bi-film",
  "/admin/plays": "bi-journal-text",
  "/admin/actors": "bi-people",
  "/admin/promo-codes": "bi-percent",
  "/admin/sales": "bi-graph-up",
  "/admin/new-reservation": "bi-plus-square",
  "/admin/checkin": "bi-check2-square",
  "/admin/scan": "bi-qr-code-scan",
  "/account/settings": "bi-person-circle",
};

/**
 * Phones: a top bar with a menu button. Computer: a left sidebar that can be
 * collapsed to icons; the choice is remembered. Wraps the page content so it
 * can make room for the sidebar.
 */
export function AdminShell({ heading, items, children }: { heading: string; items: Item[]; children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMobile(false);
  }, [path]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const isCurrent = (n: Item) => path === n.href || path.startsWith(`${n.href}/`);

  return (
    <div className="min-h-screen bg-white">
      {/* Phones */}
      <header className="md:hidden sticky top-0 z-40 text-white">
        <nav className="bg-black aa-container !max-w-6xl py-3">
          <div className="flex items-center justify-between">
            <span className="font-black tracking-[0.12em] text-sm">{heading}</span>
            <button className="text-2xl leading-none p-1" aria-label="Toggle menu" aria-expanded={openMobile} onClick={() => setOpenMobile((v) => !v)}>
              <i className={`bi ${openMobile ? "bi-x-lg" : "bi-list"}`} />
            </button>
          </div>
          {openMobile && (
            <div className="flex flex-col pt-2">
              {items.map((n, i) => (
                <div key={n.href}>
                  {n.group && n.group !== items[i - 1]?.group && (
                    <p className="aa-label opacity-60 mt-3 mb-0 px-3">{n.group}</p>
                  )}
                  <Link href={n.href} className={`aa-nav-link py-2.5 ${isCurrent(n) ? "underline underline-offset-8 decoration-2" : ""}`}>
                    {n.label}
                  </Link>
                </div>
              ))}
              <Link href="/" className="aa-nav-link py-2.5 opacity-75">View site</Link>
            </div>
          )}
        </nav>
      </header>

      {/* Computer */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col bg-black text-white transition-[width] duration-200 ${collapsed ? "w-16" : "w-64"}`}
        aria-label="Admin menu"
      >
        <div className={`flex items-center h-16 shrink-0 border-b border-white/15 ${collapsed ? "justify-center" : "justify-between px-5"}`}>
          {!collapsed && <span className="font-black tracking-[0.12em] text-sm leading-tight">{heading}</span>}
          <button
            type="button"
            onClick={toggle}
            className="text-xl leading-none p-2 hover:bg-white/10"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <i className={`bi ${collapsed ? "bi-layout-sidebar" : "bi-layout-sidebar-inset"}`} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((n, i) => {
            const on = isCurrent(n);
            const newGroup = !!n.group && n.group !== items[i - 1]?.group;
            return (
              <div key={n.href}>
                {newGroup && i > 0 && collapsed && <div className="mx-3 my-2 border-t border-white/15" />}
                {newGroup && !collapsed && (
                  <p className={`aa-label opacity-50 px-5 mb-1 ${i > 0 ? "mt-4" : "mt-1"}`}>{n.group}</p>
                )}
              <Link
                href={n.href}
                title={collapsed ? n.label : undefined}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] border-l-4 py-3 ${collapsed ? "justify-center px-0" : "px-5"} ${
                  on ? "border-accent bg-white/10" : "border-transparent hover:bg-white/10"
                }`}
              >
                <i className={`bi ${ICONS[n.href] ?? "bi-dot"} text-base leading-none`} />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
              </div>
            );
          })}
        </nav>
        <Link
          href="/"
          title={collapsed ? "View site" : undefined}
          className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] py-4 border-t border-white/15 opacity-75 hover:opacity-100 ${collapsed ? "justify-center" : "px-5"}`}
        >
          <i className="bi bi-box-arrow-up-right text-base leading-none" />
          {!collapsed && "View site"}
        </Link>
      </aside>

      <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-16" : "md:pl-64"}`}>{children}</div>
    </div>
  );
}
