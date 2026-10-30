"use client";

import { sortByName } from "@/lib/sort";
import { toast } from "@/lib/toast";

import { useEffect, useState } from "react";

type Production = { id: string; title: string; slug: string };
type Performance = { id: string; label: string; datetime: string };
type Tier = { id: string; label: string; price: number };
type Preview = { valid: boolean; reason?: string; pricing?: { subtotal: number; discountAmount: number; total: number } };

export default function NewReservationPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [productionId, setProductionId] = useState("");
  const [performanceId, setPerformanceId] = useState("");
  const [tierId, setTierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"confirmed" | "pending_review">("confirmed");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const tier = tiers.find((t) => t.id === tierId);
  const subtotal = tier ? tier.price * quantity : 0;

  useEffect(() => {
    const code = promoCode.trim();
    if (!code || !tierId || !productionId || quantity < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, production_id: productionId, lines: [{ ticket_tier_id: tierId, quantity }] }),
      });
      setPreview(res.ok ? await res.json() : null);
    }, 400);
    return () => clearTimeout(t);
  }, [promoCode, tierId, quantity, productionId]);

  useEffect(() => {
    fetch("/api/admin/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []));
  }, []);

  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/admin/productions/${productionId}/performances`)
      .then((r) => r.json())
      .then((d) => setPerformances(d.performances ?? []));
  }, [productionId]);

  useEffect(() => {
    if (!performanceId) return;
    fetch(`/api/admin/performances/${performanceId}/tiers`)
      .then((r) => r.json())
      .then((d) => setTiers(d.tiers ?? []));
  }, [performanceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const fd = new FormData();
    fd.set("performance_id", performanceId);
    fd.set("buyer_name", buyerName);
    fd.set("buyer_email", buyerEmail);
    fd.set("buyer_phone", buyerPhone);
    fd.set("status", status);
    fd.set("items", JSON.stringify([{ ticket_tier_id: tierId, quantity }]));
    if (promoCode.trim()) fd.set("promo_code", promoCode.trim());
    if (proof) fd.set("payment_proof", proof);
    const res = await fetch("/api/admin/reservations/manual", { method: "POST", body: fd });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      toast.error(data.error ?? "Could not create the reservation.");
      setMessage(data.error);
      return;
    }
    toast.success(`Reservation ${data.reservation.reference_code} created.`);
    setMessage(`Reservation ${data.reservation.reference_code} created.`);
    setBuyerName("");
    setBuyerEmail("");
    setBuyerPhone("");
    setQuantity(1);
    setPromoCode("");
    setPreview(null);
    setProof(null);
    setFileKey((k) => k + 1);
    if (data.proofWarning) toast.error(data.proofWarning);
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-extrabold text-3xl mb-2">New reservation</h1>
      <p className="text-muted text-sm mb-6">
        For walk-ins and phone/DM bookings. Email is optional - without it, check the buyer in at
        the door using name or reference-code lookup instead of a QR email.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={productionId}
          onChange={(e) => setProductionId(e.target.value)}
          required
          className="w-full border border-ink/20  px-3 py-2"
        >
          <option value="">Select production...</option>
          {sortByName(productions, (p) => p.title).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={performanceId}
          onChange={(e) => setPerformanceId(e.target.value)}
          required
          disabled={!productionId}
          className="w-full border border-ink/20  px-3 py-2"
        >
          <option value="">Select performance...</option>
          {performances.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="flex gap-3">
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            required
            disabled={!performanceId}
            className="flex-1 border border-ink/20  px-3 py-2"
          >
            <option value="">Select tier...</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} - ₱{t.price.toFixed(2)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-20 border border-ink/20  px-3 py-2"
          />
        </div>

        <input
          placeholder="Buyer name"
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          required
          className="w-full border border-ink/20  px-3 py-2"
        />
        <input
          placeholder="Email (optional)"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          className="w-full border border-ink/20  px-3 py-2"
        />
        <input
          placeholder="Phone"
          value={buyerPhone}
          onChange={(e) => setBuyerPhone(e.target.value)}
          className="w-full border border-ink/20  px-3 py-2"
        />

        <input
          placeholder="Promo code (optional)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          className="w-full border border-ink/20 px-3 py-2 uppercase"
        />
        {preview && !preview.valid && <p className="text-sm text-danger">{preview.reason}</p>}

        <label className="block text-sm">
          <span className="block text-xs font-bold uppercase text-muted mb-1">Proof of payment (optional)</span>
          <input
            key={fileKey}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </label>

        {tier && (
          <div className="aa-card p-3 text-sm space-y-0.5">
            <div className="flex justify-between"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
            {preview?.valid && preview.pricing && (
              <div className="flex justify-between text-green-700"><span>Discount</span><span>-₱{preview.pricing.discountAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-black">
              <span>Total</span>
              <span>₱{(preview?.valid && preview.pricing ? preview.pricing.total : subtotal).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={status === "confirmed"}
              onChange={() => setStatus("confirmed")}
            />
            Confirmed (paid now)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={status === "pending_review"}
              onChange={() => setStatus("pending_review")}
            />
            Pending (payment expected)
          </label>
        </div>

        {message && <p className="text-sm text-danger">{message}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3  bg-black text-paper font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create reservation"}
        </button>
      </form>
    </div>
  );
}
