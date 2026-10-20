import type { ProductionPartner } from "@/types/database";
import { SPONSOR_LEVELS, sortPartners } from "@/lib/partners";

const LOGO_H: Record<string, string> = {
  co_presenter: "h-28 max-w-[320px]",
  major: "h-20 max-w-[240px]",
  minor: "h-14 max-w-[170px]",
  default: "h-16 max-w-[200px]",
};

function PartnerMark({ p, size }: { p: ProductionPartner; size: string }) {
  const inner = p.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.logo_url} alt={p.name} className={`${size} w-auto object-contain`} />
  ) : (
    <span className="font-black uppercase tracking-[0.06em]">{p.name}</span>
  );
  return p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:opacity-70 transition" title={p.name}>
      {inner}
    </a>
  ) : (
    <span className="inline-flex items-center">{inner}</span>
  );
}

function Group({ title, items, size, textClass }: { title: string; items: ProductionPartner[]; size: string; textClass?: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <p className="aa-label text-muted mb-0">{title}</p>
      <div className={`flex flex-wrap items-center gap-x-10 gap-y-6 ${textClass ?? ""}`}>
        {items.map((p) => <PartnerMark key={p.id} p={p} size={size} />)}
      </div>
    </div>
  );
}

export function PartnersSection({ partners }: { partners: ProductionPartner[] }) {
  if (!partners.length) return null;
  const sponsors = sortPartners(partners.filter((p) => p.category === "sponsor"));
  const media = sortPartners(partners.filter((p) => p.category === "media"));
  const orgs = sortPartners(partners.filter((p) => p.category === "organization"));
  const thanks = sponsors.filter((p) => p.sponsor_level === "special_thanks");

  return (
    <section>
      <h2 className="text-2xl mb-2">Partners</h2>
      <hr className="aa-divider" />
      <div className="space-y-10">
        {sponsors.length > 0 && (
          <div className="space-y-6">
            <p className="font-black uppercase tracking-[0.08em] mb-0">Sponsors</p>
            {SPONSOR_LEVELS.filter((l) => l.value !== "special_thanks").map((l) => (
              <Group
                key={l.value}
                title={l.name}
                items={sponsors.filter((p) => p.sponsor_level === l.value)}
                size={LOGO_H[l.value]}
                textClass={l.value === "co_presenter" ? "text-3xl" : l.value === "major" ? "text-2xl" : "text-lg"}
              />
            ))}
            {thanks.length > 0 && (
              <div className="space-y-2">
                <p className="aa-label text-muted mb-0">Special Thanks to</p>
                <p className="mb-0 text-sm">
                  {thanks.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " · "}
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">{p.name}</a>
                      ) : (
                        p.name
                      )}
                    </span>
                  ))}
                </p>
              </div>
            )}
          </div>
        )}
        <Group title="Media Partners" items={media} size={LOGO_H.default} textClass="text-lg" />
        <Group title="Partner Organizations" items={orgs} size={LOGO_H.default} textClass="text-lg" />
      </div>
    </section>
  );
}
