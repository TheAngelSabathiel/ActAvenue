"use client";

import { toast } from "@/lib/toast";

import { useEffect, useRef, useState } from "react";
import { useCart, CartError } from "@/lib/hooks/use-cart";
import { createClient } from "@/lib/supabase/client";
import { formatDayLong, formatDayShort, formatTime } from "@/lib/datetime";
import { ID_INSTRUCTION, applyRemaining } from "@/lib/tiers";
import { isTierDiscountActive } from "@/lib/pricing";
import { AddedToCartModal, type AddedItem } from "@/components/added-to-cart-modal";
import type { PerformanceWithTiers, TicketTier } from "@/types/database";

export function PerformancePicker({
  performances: initialPerformances,
  productionTitle,
}: {
  performances: PerformanceWithTiers[];
  productionTitle: string;
}) {
  const { addItem } = useCart();
  const [performances, setPerformances] = useState(initialPerformances);
  // With several dates nothing is preselected, so people choose on purpose.
  const [activeId, setActiveId] = useState<string | undefined>(initialPerformances.length === 1 ? initialPerformances[0]?.id : undefined);
  const [step1Open, setStep1Open] = useState(initialPerformances.length !== 1);
  const [step2Open, setStep2Open] = useState(true);
  const [added, setAdded] = useState<AddedItem | null>(null);
  const [now] = useState(() => Date.now());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [idFor, setIdFor] = useState<{ tierId: string; performanceId: string } | null>(null);
  const qtyOf = (tier: TicketTier & { remaining?: number }) => Math.min(Math.max(1, qty[tier.id] ?? 1), Math.max(1, tier.remaining ?? 1));
  const [idFile, setIdFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Record<string, "idle" | "adding" | "added" | "error">>({});

  // Live remaining-quantity counts: subscribe to ticket_tiers changes so
  // the count updates as other buyers check out or holds expire, without
  // needing a page refresh. Requires `ticket_tiers` to be added to the
  // `supabase_realtime` publication - see supabase/schema.sql.
  useEffect(() => {
    const tierIds = new Set(
      initialPerformances.flatMap((p) => p.ticket_tiers.map((t) => t.id))
    );
    if (tierIds.size === 0) return;

    const supabase = createClient();

    // The page may come from the CDN cache, so read the live counts once on load.
    supabase
      .from("ticket_tiers")
      .select("*")
      .in("id", [...tierIds])
      .then(({ data }) => {
        if (!data) return;
        const fresh = new Map(data.map((t) => [t.id as string, t]));
        setPerformances((prev) =>
          prev.map((perf) => ({
            ...perf,
            // Seats left are worked out per show, because linked tiers share a pool.
            ticket_tiers: applyRemaining(
              perf.ticket_tiers.map((tier) => {
                const f = fresh.get(tier.id);
                return f ? { ...tier, ...f } : tier;
              })
            ).map((tier) => ({ ...tier, discount_active: isTierDiscountActive(tier as TicketTier) })),
          }))
        );
      });

    const channel = supabase
      .channel("ticket-tier-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ticket_tiers" },
        (payload) => {
          const updated = payload.new as TicketTier;
          if (!tierIds.has(updated.id)) return;

          setPerformances((prev) =>
            prev.map((perf) => {
              if (!perf.ticket_tiers.some((t) => t.id === updated.id)) return perf;
              return {
                ...perf,
                ticket_tiers: applyRemaining(
                  perf.ticket_tiers.map((tier) =>
                    tier.id === updated.id
                      ? {
                          ...tier,
                          quantity_available: updated.quantity_available,
                          quantity_held: updated.quantity_held,
                          pool_tier_id: updated.pool_tier_id ?? null,
                          pool_capped: updated.pool_capped ?? false,
                          discount_active: isTierDiscountActive(updated),
                        }
                      : tier
                  )
                ),
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialPerformances]);

  const active = performances.find((p) => p.id === activeId);

  function startAdd(tier: TicketTier, performanceId: string) {
    if (tier.require_id) {
      setIdFile(null);
      setIdFor({ tierId: tier.id, performanceId });
    } else {
      void handleAdd(tier.id, performanceId, null, qtyOf(tier as never));
    }
  }

  async function handleAdd(tierId: string, performanceId: string, file?: File | null, quantity = 1) {
    setStatus((s) => ({ ...s, [tierId]: "adding" }));
    try {
      await addItem(tierId, performanceId, quantity, file);
      setStatus((s) => ({ ...s, [tierId]: "idle" }));
      setIdFor(null);
      const perf = performances.find((p) => p.id === performanceId);
      const tier = perf?.ticket_tiers.find((t) => t.id === tierId);
      setAdded({
        tier: `${tier?.label ?? "Ticket"} x ${quantity}`,
        show: productionTitle,
        performance: perf?.label ?? "",
        day: perf ? formatDayLong(perf.datetime) : undefined,
        time: perf ? formatTime(perf.datetime) : undefined,
        venue: perf?.venue,
      });
    } catch (err) {
      // The ticket needs an ID we do not have yet: ask for it instead of failing.
      if (err instanceof CartError && err.code === "id_required") {
        setStatus((s) => ({ ...s, [tierId]: "idle" }));
        setIdFile(null);
        setIdFor({ tierId, performanceId });
        return;
      }
      setStatus((s) => ({ ...s, [tierId]: "error" }));
      toast.error(err instanceof Error ? err.message : "Could not add to cart.");
    }
  }

  if (!performances.length) {
    return (
      <div className="aa-card p-8 text-center">
        <p className="font-bold uppercase tracking-[0.08em] mb-0">No performances scheduled yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {added && <AddedToCartModal item={added} onClose={() => setAdded(null)} />}
      {idFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setIdFor(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="aa-card w-full max-w-md p-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="aa-label text-muted mb-0">Step 3: upload your ID</p>
            <p className="font-black text-xl mb-0">Discounted ticket</p>
            <p className="mb-0">{ID_INSTRUCTION}</p>
            <p className="text-xs text-muted mb-0">Photo or PDF, up to 8 MB. Only our team can see it.</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                setIdFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
              className="hidden"
              aria-label="Upload ID"
            />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInput.current?.click()} className="aa-btn aa-btn-outline aa-btn-sm shrink-0">
                <i className={`bi ${idFile ? "bi-arrow-repeat" : "bi-upload"}`} /> {idFile ? "Replace file" : "Choose file"}
              </button>
              {!idFile && <span className="text-sm text-muted">No file chosen</span>}
            </div>
            {idFile && (
              <p className="text-sm font-bold mb-0 flex items-center justify-between gap-2">
                <span className="truncate"><i className="bi bi-check-circle" /> {idFile.name}</span>
                <button type="button" onClick={() => setIdFile(null)} className="underline shrink-0">Remove</button>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="aa-btn flex-1"
                disabled={!idFile || status[idFor.tierId] === "adding"}
                onClick={() => {
                  const t = performances.flatMap((p) => p.ticket_tiers).find((x) => x.id === idFor.tierId);
                  void handleAdd(idFor.tierId, idFor.performanceId, idFile, t ? qtyOf(t) : 1);
                }}
              >
                {status[idFor.tierId] === "adding" ? "Uploading..." : "Upload and add to cart"}
              </button>
              <button className="aa-btn aa-btn-outline flex-1" onClick={() => setIdFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setStep1Open((v) => !v)}
          aria-expanded={step1Open}
          className="w-full flex items-center justify-between gap-3 text-left border-b-2 border-black pb-2"
        >
          <span>
            <span className="aa-label text-muted block mb-0">Step 1: choose your show date</span>
            {!step1Open && active && (
              <span className="font-black">{formatDayShort(active.datetime)} · {formatTime(active.datetime)}</span>
            )}
          </span>
          <span className="aa-label mb-0 flex items-center gap-1 shrink-0">
            {step1Open ? "Hide" : "Change"} <i className={`bi ${step1Open ? "bi-chevron-up" : "bi-chevron-down"}`} />
          </span>
        </button>
        {step1Open && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
            {performances.map((p) => {
              const on = activeId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveId(p.id);
                    setStep1Open(false);
                    setStep2Open(true);
                  }}
                  aria-pressed={on}
                  className={`text-left border-2 border-black p-4 transition ${on ? "bg-black text-white" : "bg-white hover:bg-[#f2f2f2]"}`}
                >
                  <span className="block text-xl font-black leading-tight">{formatDayShort(p.datetime)}</span>
                  <span className="block text-lg font-bold">{formatTime(p.datetime)}</span>
                  <span className={`block text-sm ${on ? "opacity-80" : "text-black/70"}`}>{p.venue}</span>
                  {on && <span className="aa-label mt-2 inline-block bg-accent text-black px-2 py-0.5">Selected</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep2Open((v) => !v)}
            aria-expanded={step2Open}
            className="w-full text-left bg-black text-white p-5 border-l-[8px] border-accent flex items-start justify-between gap-3"
          >
            <span>
              <span className="aa-label opacity-75 block mb-1">Step 2: you are booking</span>
              {step2Open ? (
                <>
                  <span className="block text-2xl md:text-3xl font-black mb-1">{formatDayLong(active.datetime)}</span>
                  <span className="block text-2xl md:text-3xl font-black mb-2">{formatTime(active.datetime)}</span>
                  <span className="block text-lg"><i className="bi bi-geo-alt" /> {active.venue}</span>
                </>
              ) : (
                <span className="block text-lg font-black">{formatDayShort(active.datetime)} · {formatTime(active.datetime)} · {active.venue}</span>
              )}
            </span>
            <span className="aa-label mb-0 flex items-center gap-1 shrink-0 pt-1">
              {step2Open ? "Hide tickets" : "Show tickets"} <i className={`bi ${step2Open ? "bi-chevron-up" : "bi-chevron-down"}`} />
            </span>
          </button>

          {step2Open && (<div className="grid gap-4 sm:grid-cols-2">
            {active.ticket_tiers.map((tier) => {
              const s = status[tier.id] ?? "idle";
              const soldOut = tier.remaining <= 0;
              const low = !soldOut && tier.remaining <= 10;
              const until = tier.discount_active && tier.discount_valid_until ? new Date(tier.discount_valid_until) : null;
              const endsSoon = !!until && until.getTime() - now <= 3 * 24 * 3600 * 1000;
              return (
                <div key={tier.id} className={`aa-card flex flex-col sm:flex-row ${soldOut ? "opacity-60 grayscale pointer-events-none select-none" : "aa-lift"}`} aria-disabled={soldOut}>
                  <div className="flex-1 p-5">
                    <p className="font-black text-lg mb-1">{tier.label}</p>
                    {tier.description && <p className="text-sm mb-1 whitespace-pre-line">{tier.description}</p>}
                    {tier.require_id && (
                      <p className="text-sm font-bold mb-1"><i className="bi bi-person-vcard" /> ID required (Student, PWD, Senior). You upload it when you add this ticket.</p>
                    )}
                    {soldOut && <span className="aa-label bg-black text-white px-2 py-0.5 inline-block mr-1">Sold out</span>}
                    {tier.discount_active && !soldOut && (
                      <span className="aa-label bg-accent px-2 py-0.5 inline-block">Limited-time price</span>
                    )}
                    {endsSoon && !soldOut && (
                      <span className="aa-label bg-danger text-white px-2 py-0.5 inline-block ml-1">Ends soon · {formatDayShort(tier.discount_valid_until!)}</span>
                    )}
                    <p className={`text-sm mt-2 mb-0 ${low ? "text-danger font-bold" : "text-muted"}`}>
                      {soldOut ? "Sold out" : `${tier.remaining} left`}
                    </p>
                  </div>
                  <div className="aa-perforation p-5 flex flex-col justify-between gap-3 sm:w-44">
                    <p className="font-black text-2xl mb-0">₱{tier.price.toFixed(2)}</p>
                    {!soldOut && (
                      <div className="flex items-center gap-2" role="group" aria-label={`Quantity for ${tier.label}`}>
                        <span className="aa-label mb-0">Qty</span>
                        <button type="button" className="aa-btn aa-btn-outline aa-btn-sm !px-3" aria-label="Fewer" onClick={() => setQty((q) => ({ ...q, [tier.id]: Math.max(1, qtyOf(tier) - 1) }))}>-</button>
                        <span className="w-6 text-center font-black tabular-nums">{qtyOf(tier)}</span>
                        <button type="button" className="aa-btn aa-btn-outline aa-btn-sm !px-3" aria-label="More" disabled={qtyOf(tier) >= tier.remaining} onClick={() => setQty((q) => ({ ...q, [tier.id]: Math.min(tier.remaining, qtyOf(tier) + 1) }))}>+</button>
                      </div>
                    )}
                    <button
                      disabled={soldOut || s === "adding"}
                      onClick={() => startAdd(tier, active.id)}
                      className="aa-btn aa-btn-sm w-full"
                    >
                      {soldOut ? "Sold out" : s === "adding" ? "Adding..." : tier.require_id ? "Upload ID and add" : qtyOf(tier) > 1 ? `Add ${qtyOf(tier)} to cart` : "Add to cart"}
                    </button>
                    {s === "error" && (
                      <p className="text-danger text-xs font-bold mb-0">Could not add. Try again.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>)}
        </div>
      )}
    </div>
  );
}
