"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type HomeShowCard = {
  id: string;
  slug: string;
  title: string;
  image: string;
  venue: string | null;
  dates: string | null;
};

export function HomeShows({ shows }: { shows: HomeShowCard[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = term
    ? shows.filter((s) => `${s.title} ${s.venue ?? ""} ${s.dates ?? ""}`.toLowerCase().includes(term))
    : shows;

  return (
    <div>
      <div className="relative max-w-xl mx-auto mb-12">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a show"
          aria-label="Search a show"
          className="aa-input w-full !pr-12 !rounded-full"
        />
        <i className="bi bi-search absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
      </div>

      <h2 className="text-3xl mb-2">Current Productions</h2>
      <hr className="aa-divider" />

      {list.length === 0 ? (
        <p className="text-center text-muted mb-0">No shows match &ldquo;{q.trim()}&rdquo;.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <Link key={s.id} href={`/productions/${s.slug}`} className="group block">
              <div className="relative aspect-[5/3] overflow-hidden bg-black shadow-sm">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="text-lg mt-3 mb-1 group-hover:underline">{s.title}</h3>
              {s.venue && <p className="text-sm mb-0 opacity-75">{s.venue}</p>}
              {s.dates && <p className="text-sm mb-0 opacity-75">{s.dates}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
