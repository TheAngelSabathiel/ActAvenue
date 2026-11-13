import Link from "next/link";
import { GAMES } from "@/lib/games";

export const metadata = {
  title: "Play",
  description: "Quick games from Act Avenue. Pick one and find out which show is yours.",
};

export default function PlayPage() {
  return (
    <div className="aa-container max-w-3xl py-12 sm:py-16">
      <h1 className="text-4xl mb-2">Play</h1>
      <hr className="aa-divider" />
      <p className="text-lg mb-8">Quick games from Act Avenue. Pick one.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link key={g.slug} href={`/play/${g.slug}`} className="aa-card aa-lift p-6 flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-[0.15em] mb-0">{g.eyebrow}</p>
            <h2 className="text-2xl mb-0">{g.name}</h2>
            <p className="text-sm text-muted mb-0">{g.cardLine}</p>
            <span className="aa-btn aa-btn-black aa-btn-sm self-start mt-1">Play</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
