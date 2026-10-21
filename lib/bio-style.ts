import type { CSSProperties } from "react";

export const BIO_SIZES = {
  small: { label: "Small", css: "1rem" },
  medium: { label: "Medium", css: "1.125rem" },
  large: { label: "Large", css: "1.3rem" },
} as const;

export const BIO_ALIGNS = {
  justify: { label: "Justified" },
  left: { label: "Left" },
  center: { label: "Center" },
} as const;

export const BIO_FONTS = {
  default: { label: "Classic Sans", css: 'var(--font-sans)' },
  playfair: { label: "Playfair", css: '"Playfair Display", Georgia, serif' },
  lora: { label: "Lora", css: 'Lora, Georgia, serif' },
  courier: { label: "Script", css: '"Courier Prime", "Courier New", monospace' },
  caveat: { label: "Handwritten", css: 'Caveat, cursive' },
} as const;

export const BIO_COLORS = {
  default: { label: "Black", css: "#000000" },
  charcoal: { label: "Charcoal", css: "#495057" },
  crimson: { label: "Crimson", css: "#9b1c1c" },
  navy: { label: "Navy", css: "#1d3557" },
  forest: { label: "Forest", css: "#2d6a4f" },
  plum: { label: "Plum", css: "#6a2c70" },
} as const;

export type BioSize = keyof typeof BIO_SIZES;
export type BioAlign = keyof typeof BIO_ALIGNS;
export type BioFont = keyof typeof BIO_FONTS;
export type BioColor = keyof typeof BIO_COLORS;

export interface BioStyle {
  bio_size: BioSize;
  bio_align: BioAlign;
  bio_font: BioFont;
  bio_color: BioColor;
}

export const DEFAULT_BIO_STYLE: BioStyle = { bio_size: "small", bio_align: "justify", bio_font: "default", bio_color: "default" };

const pick = <T extends string>(map: Record<T, unknown>, v: unknown, fallback: T): T =>
  typeof v === "string" && v in map ? (v as T) : fallback;

/** Cleans any stored or submitted values down to known options. */
export function cleanBioStyle(v: Partial<Record<keyof BioStyle, unknown>> | null | undefined): BioStyle {
  return {
    bio_size: pick(BIO_SIZES, v?.bio_size, "small"),
    bio_align: pick(BIO_ALIGNS, v?.bio_align, "justify"),
    bio_font: pick(BIO_FONTS, v?.bio_font, "default"),
    bio_color: pick(BIO_COLORS, v?.bio_color, "default"),
  };
}

/** Class and inline style for a rendered bio. Justified falls back to left on phones. */
export function bioPresentation(v: Partial<Record<keyof BioStyle, unknown>> | null | undefined): { className: string; style: CSSProperties } {
  const s = cleanBioStyle(v);
  const align = s.bio_align === "justify" ? "text-left sm:text-justify hyphens-auto" : s.bio_align === "center" ? "text-center" : "text-left";
  return {
    className: `${align} whitespace-pre-line`,
    style: { fontSize: s.bio_font === "caveat" ? `calc(${BIO_SIZES[s.bio_size].css} * 1.25)` : BIO_SIZES[s.bio_size].css, fontFamily: BIO_FONTS[s.bio_font].css, color: BIO_COLORS[s.bio_color].css },
  };
}
