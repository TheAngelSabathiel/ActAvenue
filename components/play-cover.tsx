import Image from "next/image";

/** Title-as-placeholder tile for plays with no uploaded photo yet. */
export function TitleTile({ title, className = "" }: { title: string; className?: string }) {
  const size = title.length > 28 ? "text-lg" : title.length > 14 ? "text-2xl" : "text-3xl";
  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-black p-4 text-center text-white ${className}`}>
      <span className={`font-black uppercase leading-tight tracking-[0.08em] break-words ${size}`}>{title}</span>
    </div>
  );
}

/** Fills its relatively positioned parent with the play photo, or the title if there is none. */
export function PlayCover({
  title,
  photoUrl,
  sizes,
  priority,
}: {
  title: string;
  photoUrl: string | null;
  sizes: string;
  priority?: boolean;
}) {
  if (!photoUrl) return <TitleTile title={title} />;
  return <Image src={photoUrl} alt="" fill sizes={sizes} className="object-cover" priority={priority} />;
}

/**
 * Full photo for a play's own page. Shown uncropped at its natural shape,
 * capped at 1080:1350 (4:5) so very tall photos do not run away. Plays with no
 * photo get the title tile.
 */
export function PlayPhotoFull({ title, photoUrl, sizes, priority }: { title: string; photoUrl: string | null; sizes: string; priority?: boolean }) {
  if (!photoUrl) {
    return (
      <div className="relative aspect-[4/3]">
        <TitleTile title={title} />
      </div>
    );
  }
  return (
    <div className="@container">
      <div className="overflow-hidden max-h-[125cqw] bg-black/5">
        <Image src={photoUrl} alt={title} width={1080} height={1350} sizes={sizes} className="w-full h-auto block" priority={priority} />
      </div>
    </div>
  );
}
