"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
const PIN_KEY = "aa-admin-nav-pinned";

/**
 * Computer: a thin strip with a small tab naming the current section. Hovering
 * or focusing it slides the full menu over the page, so nothing moves. Pin keeps
 * it open. Phones: a menu button, no sideways scroll.
 */
export function AdminNav({ heading, items }: { heading: string; items: Item[] }) {
  const [openMobile, setOpenMobile] = useState(false);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const path = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMobile(false);
    setHover(false);
  }, [path]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const current = items.find((n) => path === n.href || path.startsWith(`${n.href}/`));
  const open = hover || pinned;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHover(true);
  };
  const hideSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(false), 300);
  };
  function togglePin() {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const links = (cls: string) =>
    items.map((n) => (
      <Link key={n.href} href={n.href} className={`aa-nav-link ${cls} ${n === current ? "underline underline-offset-8 decoration-2" : ""}`}>
        {n.label}
      </Link>
    ));

  return (
    <header ref={wrap} className="sticky top-0 z-40 text-white">
      {/* Phones */}
      <nav className="md:hidden bg-black aa-container !max-w-6xl py-3">
        <div className="flex items-center justify-between">
          <span className="font-black tracking-[0.12em] text-sm">{heading}</span>
          <button className="text-2xl leading-none p-1" aria-label="Toggle menu" aria-expanded={openMobile} onClick={() => setOpenMobile((v) => !v)}>
            <i className={`bi ${openMobile ? "bi-x-lg" : "bi-list"}`} />
          </button>
        </div>
        {openMobile && (
          <div className="flex flex-col pt-2">
            {links("py-2.5")}
            <Link href="/" className="aa-nav-link py-2.5 opacity-75">View site</Link>
          </div>
        )}
      </nav>

      {/* Computer */}
      <div
        className="hidden md:block relative"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hideSoon();
        }}
      >
        <div className="h-2 bg-black" />
        {!open && (
          <button
            type="button"
            onClick={show}
            className="absolute left-6 top-2 bg-black text-white text-xs font-bold uppercase tracking-[0.1em] px-3 py-1.5 flex items-center gap-2"
            aria-label="Open admin menu"
          >
            <i className="bi bi-list" />
            {current?.label ?? "Menu"}
          </button>
        )}
        <nav
          className={`${pinned ? "" : "absolute inset-x-0 top-0 shadow-lg"} bg-black transition-transform duration-200 ${
            open ? "translate-y-0" : "-translate-y-full pointer-events-none"
          }`}
          aria-hidden={!open}
        >
          <div className="aa-container !max-w-6xl py-3 flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span className="font-black tracking-[0.12em] mr-2 shrink-0">{heading}</span>
            <button
              type="button"
              onClick={togglePin}
              className="aa-nav-link shrink-0 !px-2 mr-2"
              aria-pressed={pinned}
              title={pinned ? "Let the menu hide again" : "Keep the menu open"}
            >
              <i className={`bi ${pinned ? "bi-pin-angle-fill" : "bi-pin-angle"}`} /> <span className="sr-only">{pinned ? "Pinned" : "Pin"}</span>
            </button>
            {links("whitespace-nowrap")}
            <Link href="/" className="aa-nav-link shrink-0 whitespace-nowrap ml-auto opacity-75">View site</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
