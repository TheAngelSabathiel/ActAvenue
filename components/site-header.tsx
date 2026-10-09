"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { IMAGES } from "@/lib/images";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setEmail(null);
    setOpen(false);
  }

  const close = () => setOpen(false);

  return (
    <header
      className="aa-navbar sticky top-0 z-50"
      style={{ ["--aa-navbar-img" as string]: `url(${IMAGES.navbar})` }}
    >
      <div className="aa-container py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-black tracking-[0.12em] text-black" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMAGES.logo}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          ACT AVENUE
        </Link>
        <button
          className="md:hidden text-2xl leading-none p-1"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`bi ${open ? "bi-x-lg" : "bi-list"}`} />
        </button>
        <nav
          className={`${open ? "flex" : "hidden"} md:flex absolute md:static left-0 right-0 top-full bg-white md:bg-transparent border-b md:border-0 border-[#dee2e6] flex-col md:flex-row md:items-center gap-1 md:gap-1 px-6 py-3 md:p-0`}
        >
          <Link href="/#now-showing" className="aa-nav-link" onClick={close}>Shows</Link>
          <Link href="/actors" className="aa-nav-link" onClick={close}>Cast &amp; Crew</Link>
          <Link href="/#about" className="aa-nav-link" onClick={close}>About</Link>
          {email ? (
            <>
              <Link href="/account" className="aa-nav-link" onClick={close}>My Tickets</Link>
              <Link href="/account/settings" className="aa-nav-link" onClick={close}>Settings</Link>
              <button onClick={handleSignOut} className="aa-nav-link text-left">Sign Out</button>
            </>
          ) : (
            <Link href="/account/login" className="aa-nav-link" onClick={close}>Sign In</Link>
          )}
          <Link href="/cart" className="aa-btn aa-btn-sm md:ml-2 mt-2 md:mt-0 self-start" onClick={close}>
            <i className="bi bi-cart3" /> Cart
          </Link>
        </nav>
      </div>
    </header>
  );
}
