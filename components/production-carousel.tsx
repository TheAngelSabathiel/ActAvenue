"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

  return (
    <div
      className="relative mx-auto max-w-3xl shadow-[0_1rem_3rem_rgba(0,0,0,.175)]"
      role="region"
      aria-roledescription="carousel"
      aria-label="Current productions"
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") go(current - 1);
        if (e.key === "ArrowRight") go(current + 1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
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
            <i className="bi bi-chevron-left" />
          </button>
          <button type="button" className="aa-arrow right-3" aria-label="Next production" onClick={() => go(current + 1)}>
            <i className="bi bi-chevron-right" />
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
