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
  const count = productions.length;
  const many = count > 1;

  // The loop needs at least five slides so the one that wraps around does it
  // off screen. With fewer productions, repeat them (the dots still count the real ones).
  const slides = many ? Array.from({ length: Math.ceil(5 / count) * count }, (_, i) => productions[i % count]) : productions;
  const n = slides.length;
  const half = Math.floor(n / 2);

  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const current = Math.min(index, n - 1);

  const go = (i: number) => setIndex(((i % n) + n) % n);

  // Auto-advance so every production gets airtime. Pauses while the visitor
  // hovers or focuses the carousel, and is skipped for people who prefer
  // reduced motion. Depending on `current` restarts the timer after any
  // manual arrow, dot or swipe, so it never jumps right after a click.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!many || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setIndex((current + 1) % n), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [many, paused, current, n]);

  return (
    <div
      className="aa-hero relative"
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
      <div className="relative">
      <div className="aa-hero-stage">
        {slides.map((p, i) => {
          // Position relative to the current slide: 0 centered, -1 left, 1 right.
          const d = many ? ((i - current + n + half) % n) - half : 0;
          const active = d === 0;
          const visible = Math.abs(d) <= 1;
          return (
            <Link
              key={`${p.id}-${i}`}
              href={`/productions/${p.slug}`}
              className="aa-hero-slide"
              data-active={active}
              style={{
                transform: `translateX(calc(${d} * (var(--sw) + var(--gap))))`,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              aria-label={`${p.title} (${(i % count) + 1} of ${count})`}
              onClick={(e) => {
                // A side preview brings that show to the middle first.
                if (!active) {
                  e.preventDefault();
                  go(current + d);
                }
              }}
            >
              <Image
                src={p.image}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 768px) 72vw, 86vw"
                className="aa-hero-img"
              />
              <div
                className="absolute inset-x-0 bottom-0 p-5 md:p-8 text-white transition-opacity duration-500"
                style={{ opacity: active ? 1 : 0, background: "linear-gradient(to top, rgba(0,0,0,.9), transparent)" }}
              >
                <h3 className="text-2xl md:text-4xl text-white mb-1">{p.title}</h3>
                {p.description && <p className="text-sm md:text-base text-white line-clamp-2 max-w-2xl">{p.description}</p>}
                <span className="aa-btn aa-btn-accent aa-btn-sm mt-2">Get Tickets</span>
              </div>
            </Link>
          );
        })}
      </div>
      {many && (
        <>
          <button type="button" className="aa-arrow left-2 md:left-6 max-md:!hidden" aria-label="Previous production" onClick={() => go(current - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" /></svg>
          </button>
          <button type="button" className="aa-arrow right-2 md:right-6 max-md:!hidden" aria-label="Next production" onClick={() => go(current + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" /></svg>
          </button>
        </>
      )}
      </div>

      {many && (
        <>
          <div className="flex justify-center gap-2 mt-5">
            {productions.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show ${p.title}`}
                aria-current={i === current % count}
                onClick={() => setIndex(i)}
                className={`h-2.5 w-2.5 border border-black transition-colors ${i === current % count ? "bg-black" : "bg-white"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
