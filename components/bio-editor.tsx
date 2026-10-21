"use client";

import { useRef, useState } from "react";
import {
  BIO_ALIGNS,
  BIO_COLORS,
  BIO_FONTS,
  BIO_SIZES,
  bioPresentation,
  type BioStyle,
} from "@/lib/bio-style";

const EMOJIS = ["🎭", "🎬", "🎤", "🎶", "🎨", "✨", "⭐", "🌟", "❤️", "🔥", "🙏", "😊", "😂", "🥹", "😎", "🤍", "🌈", "☕", "📖", "✍️", "🎞️", "🎟️", "👏", "💫", "🇵🇭", "🌙", "🌸", "💡", "🕊️", "🎉"];

function Row<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, { label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-bold uppercase text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={`px-2.5 py-1 text-xs font-bold border border-black ${value === k ? "bg-black text-white" : "bg-white hover:bg-[#f2f2f2]"}`}
          >
            {options[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bio textarea with emoji picker, size, alignment, font and color controls, and a live preview. */
export function BioEditor({
  bio,
  onBio,
  style,
  onStyle,
}: {
  bio: string;
  onBio: (v: string) => void;
  style: BioStyle;
  onStyle: (s: BioStyle) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const pres = bioPresentation(style);

  function insert(emoji: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? bio.length;
    const end = el?.selectionEnd ?? bio.length;
    onBio(bio.slice(0, start) + emoji + bio.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={ref}
        value={bio}
        onChange={(e) => onBio(e.target.value)}
        placeholder="Short bio"
        rows={5}
        className="w-full border border-ink/20 px-3 py-2 text-sm"
      />
      <div>
        <button type="button" onClick={() => setEmojiOpen((v) => !v)} aria-expanded={emojiOpen} className="text-xs font-bold uppercase border border-black px-2.5 py-1 hover:bg-[#f2f2f2]">
          😊 Emoji
        </button>
        {emojiOpen && (
          <div className="mt-2 flex flex-wrap gap-1 border border-[#dee2e6] p-2 max-w-md">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => insert(e)} className="text-xl leading-none p-1.5 hover:bg-[#f2f2f2]" aria-label={`Insert ${e}`}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Row label="Size" value={style.bio_size} options={BIO_SIZES} onChange={(v) => onStyle({ ...style, bio_size: v })} />
        <Row label="Align" value={style.bio_align} options={BIO_ALIGNS} onChange={(v) => onStyle({ ...style, bio_align: v })} />
        <Row label="Font" value={style.bio_font} options={BIO_FONTS} onChange={(v) => onStyle({ ...style, bio_font: v })} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 text-xs font-bold uppercase text-muted">Color</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BIO_COLORS) as (keyof typeof BIO_COLORS)[]).map((k) => (
              <button
                key={k}
                type="button"
                title={BIO_COLORS[k].label}
                aria-label={BIO_COLORS[k].label}
                aria-pressed={style.bio_color === k}
                onClick={() => onStyle({ ...style, bio_color: k })}
                className={`h-7 w-7 border-2 ${style.bio_color === k ? "border-black ring-2 ring-offset-1 ring-black" : "border-[#dee2e6]"}`}
                style={{ background: BIO_COLORS[k].css }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border border-dashed border-[#adb5bd] p-4">
        <p className="aa-label text-muted mb-2">Preview</p>
        <p className={`mb-0 ${pres.className}`} style={pres.style}>
          {bio || "Your bio will look like this on your profile page."}
        </p>
        {style.bio_align === "justify" && <p className="text-xs text-muted mt-2 mb-0">Justified shows as left aligned on phones so lines stay readable.</p>}
      </div>
    </div>
  );
}
