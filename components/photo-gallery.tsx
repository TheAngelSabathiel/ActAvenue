"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Photo = { id: string; photo_url: string; caption: string | null };

/** Thumbnail grid. Tap a photo to view it large; Esc, the close button or the dark area goes back. */
export function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;

  const close = useCallback(() => {
    setIndex(null);
    opener.current?.focus();
  }, []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + count) % count)), [count]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, step]);

  const current = index === null ? null : photos[index];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={(e) => {
              opener.current = e.currentTarget;
              setIndex(i);
            }}
            className="relative aspect-[3/4] overflow-hidden bg-soft cursor-zoom-in group"
            aria-label={`View photo ${i + 1} of ${count}${photo.caption ? `: ${photo.caption}` : ""}`}
          >
            <Image src={photo.photo_url} alt={photo.caption ?? ""} fill sizes="200px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photo ${index! + 1} of ${count}`}
          onClick={close}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between p-4 text-white shrink-0">
            <span className="text-sm font-bold tabular-nums">{index! + 1} / {count}</span>
            <button type="button" onClick={close} className="text-3xl leading-none p-2 -m-2" aria-label="Close" autoFocus>
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            <Image
              key={current.id}
              src={current.photo_url}
              alt={current.caption ?? ""}
              fill
              sizes="100vw"
              className="object-contain"
              onClick={(e) => e.stopPropagation()}
              priority
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-3xl p-3 bg-black/40"
                  aria-label="Previous photo"
                  onClick={(e) => { e.stopPropagation(); step(-1); }}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-3xl p-3 bg-black/40"
                  aria-label="Next photo"
                  onClick={(e) => { e.stopPropagation(); step(1); }}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </>
            )}
          </div>

          {current.caption && <p className="text-white text-center p-4 mb-0 shrink-0" onClick={(e) => e.stopPropagation()}>{current.caption}</p>}
        </div>
      )}
    </>
  );
}
