"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/** Desktop: one row that scrolls sideways when it runs long. Phones: a menu button, no sideways scroll. */
export function AdminNav({ heading, items }: { heading: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [path]);

  return (
    <nav className="aa-container !max-w-6xl py-3">
      <div className="flex items-center justify-between md:hidden">
        <span className="font-black tracking-[0.12em] text-sm">{heading}</span>
        <button
          className="text-2xl leading-none p-1"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`bi ${open ? "bi-x-lg" : "bi-list"}`} />
        </button>
      </div>
      {open && (
        <div className="md:hidden flex flex-col pt-2">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="aa-nav-link !text-white py-2.5">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="aa-nav-link !text-white py-2.5 opacity-75">
            View site
          </Link>
        </div>
      )}

      <div className="hidden md:flex items-center gap-1 overflow-x-auto">
        <span className="font-black tracking-[0.12em] mr-4 shrink-0">{heading}</span>
        {items.map((n) => (
          <Link key={n.href} href={n.href} className="aa-nav-link shrink-0 whitespace-nowrap">
            {n.label}
          </Link>
        ))}
        <Link href="/" className="aa-nav-link shrink-0 whitespace-nowrap ml-auto opacity-75">
          View site
        </Link>
      </div>
    </nav>
  );
}
