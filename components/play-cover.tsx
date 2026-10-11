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
