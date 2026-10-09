import Image from "next/image";
import Link from "next/link";
import type { ProductionCreditWithActor, PublicPlay } from "@/lib/data/productions";
import { CREDIT_TYPE_RANK } from "@/lib/credits";
import { IMAGES } from "@/lib/images";

function PersonCard({ credit, sub }: { credit: ProductionCreditWithActor; sub: string }) {
  return (
    <Link href={`/actors/${credit.profile.id}`} className="aa-card aa-lift p-4 flex items-center gap-3">
      <Image
        src={credit.profile.photo_url ?? IMAGES.headshotPlaceholder}
        alt={credit.profile.display_name ?? ""}
        width={56}
        height={56}
        className="h-14 w-14 object-cover shrink-0"
      />
      <div className="min-w-0">
        <p className="font-black mb-0">{credit.profile.display_name ?? "Cast member"}</p>
        <p className="aa-label text-muted mb-0">{sub}</p>
      </div>
    </Link>
  );
}

function NameList({ label, credits }: { label: string; credits: ProductionCreditWithActor[] }) {
  if (credits.length === 0) return null;
  return (
    <p className="mb-2">
      <span className="aa-label text-muted mr-3">{credits.length > 1 ? `${label}s` : label}</span>
      {credits.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          <Link href={`/actors/${c.profile.id}`} className="font-bold underline">
            {c.profile.display_name ?? "Cast member"}
          </Link>
        </span>
      ))}
    </p>
  );
}

export function CreditsDisplay({
  plays,
  credits,
}: {
  plays: PublicPlay[];
  credits: ProductionCreditWithActor[];
}) {
  const artistic = credits.filter((c) => c.section === "artistic");
  const crew = credits.filter((c) => c.section === "production");

  // One group per play, in the admin's order. Credits not assigned to a
  // play come first with no heading.
  const groups = [
    { id: "none", title: null as string | null, items: artistic.filter((c) => !c.play_id) },
    ...plays.map((p) => ({ id: p.id, title: p.title as string | null, items: artistic.filter((c) => c.play_id === p.id) })),
  ].filter((g) => g.items.length > 0);

  return (
    <>
      {groups.length > 0 && (
        <section>
          <h2 className="text-2xl mb-2">Artistic Team</h2>
          <hr className="aa-divider" />
          <div className="space-y-10">
            {groups.map((g) => {
              const ofType = (t: string) => g.items.filter((c) => c.credit_type === t);
              const others = g.items.filter((c) => !c.credit_type);
              const cast = [...ofType("actor"), ...others].sort(
                (a, b) => (CREDIT_TYPE_RANK[a.credit_type ?? "actor"] - CREDIT_TYPE_RANK[b.credit_type ?? "actor"]) || a.sort_order - b.sort_order
              );
              return (
                <div key={g.id}>
                  {g.title && <h3 className="text-xl mb-3">{g.title}</h3>}
                  <NameList label="Writer" credits={ofType("writer")} />
                  <NameList label="Director" credits={ofType("director")} />
                  {cast.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 mt-4">
                      {cast.map((c) => (
                        <PersonCard key={c.id} credit={c} sub={c.role_played} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {crew.length > 0 && (
        <section>
          <h2 className="text-2xl mb-2">Production &amp; Crew</h2>
          <hr className="aa-divider" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {crew.map((c) => (
              <PersonCard key={c.id} credit={c} sub={c.role_played} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
