"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/** Seconds each production stays on screen before the carousel moves on. */
const AUTO_ADVANCE_MS = 6000;

export type CarouselProduction = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image: string;
};

export function ProductionCarousel({ productions }: { productions: CarouselProduction[] }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = productions.length;
  const many = count > 1;
  const current = Math.min(index, count - 1);

  const go = (i: number) => setIndex((i + count) % count);

  // Auto-advance so every production gets airtime. Pauses while the visitor
  // hovers or focuses the carousel, and is skipped for people who prefer
  // reduced motion. Depending on `current` restarts the timer after any
  // manual arrow, dot or swipe, so it never jumps right after a click.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!many || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setIndex((current + 1) % count), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [many, paused, current, count]);

  return (
    <div
      className="relative mx-auto max-w-3xl shadow-[0_1rem_3rem_rgba(0,0,0,.175)]"
      role="region"
      aria-roledescription="carousel"
      aria-label="Current productions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") go(current - 1);
        if (e.key === "ArrowRight") go(current + 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        if (!many || touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? current + 1 : current - 1);
      }}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {productions.map((p, i) => (
            <Link
              key={p.id}
              href={`/productions/${p.slug}`}
              className="aa-featured block min-w-full md:!h-[440px]"
              aria-hidden={i !== current}
              tabIndex={i === current ? 0 : -1}
              aria-label={`${p.title} (${i + 1} of ${count})`}
            >
              <Image
                src={p.image}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 768px) 768px, 100vw"
                className="aa-featured-img"
              />
              <div className="aa-featured-overlay">
                <h3 className="text-2xl md:text-3xl text-white mb-1">{p.title}</h3>
                {p.description && <p className="text-sm text-white line-clamp-2">{p.description}</p>}
                <span className="aa-btn aa-btn-accent aa-btn-sm mt-2">Get Tickets</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {many && (
        <>
          <button type="button" className="aa-arrow left-3" aria-label="Previous production" onClick={() => go(current - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" /></svg>
          </button>
          <button type="button" className="aa-arrow right-3" aria-label="Next production" onClick={() => go(current + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" /></svg>
          </button>
          <div className="absolute -bottom-8 inset-x-0 flex justify-center gap-2">
            {productions.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show ${p.title}`}
                aria-current={i === current}
                onClick={() => setIndex(i)}
                className={`h-2.5 w-2.5 border border-black transition-colors ${i === current ? "bg-black" : "bg-white"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
