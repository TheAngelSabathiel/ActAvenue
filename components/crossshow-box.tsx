"use client";

import { useState } from "react";

export type CrossStatus = { checked: boolean; error?: string; used: number; discount: number };

/**
 * "Bought tickets to another show?" block for the cart and checkout. The email
 * is the one on the earlier booking, so it does not have to match the buyer's.
 */
export function CrossshowBox({
  email,
  onEmail,
  refs,
  onRefs,
  status,
  named,
}: {
  email: string;
  onEmail: (v: string) => void;
  refs: string;
  onRefs: (v: string) => void;
  status?: CrossStatus;
  /** Adds form field names (checkout) so the values are submitted with the booking. */
  named?: boolean;
}) {
  const [open, setOpen] = useState(!!(email || refs));
  return (
    <div className="border border-black/20 bg-white">
      {named && (
        <>
          <input type="hidden" name="crossshow_email" value={email} />
          <input type="hidden" name="crossshow_ref" value={refs} />
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em]">
          <i className="bi bi-ticket-perforated text-base leading-none" /> Bought tickets to another show?
        </span>
        <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"} text-sm`} />
      </button>
      {open && (
        <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2 border-t border-black/10 pt-3">
          <label className="block min-w-0">
            <span className="aa-label block mb-1">Email on that booking</span>
            <input type="email" value={email} onChange={(e) => onEmail(e.target.value)} className="aa-input" autoComplete="off" />
          </label>
          <label className="block min-w-0">
            <span className="aa-label block mb-1">Booking code(s)</span>
            <input value={refs} onChange={(e) => onRefs(e.target.value.toUpperCase())} className="aa-input uppercase" autoComplete="off" />
          </label>
          <p className="sm:col-span-2 text-xs text-muted mb-0">
            Each ticket from a confirmed booking of a show on sale now takes the discount off one Regular ticket. Use several codes by separating them with commas.
          </p>
          {status?.checked && status.error && <p className="sm:col-span-2 text-sm text-danger font-bold mb-0">{status.error}</p>}
          {status?.checked && !status.error && status.used > 0 && (
            <p className="sm:col-span-2 text-sm text-success font-bold mb-0">
              Applied to {status.used} ticket{status.used === 1 ? "" : "s"}. You save ₱{status.discount.toFixed(2)}.
            </p>
          )}
          {status?.checked && !status.error && status.used === 0 && (
            <p className="sm:col-span-2 text-sm text-muted font-bold mb-0">
              Accepted, but no discount applies to this cart. It may not cover these shows, or another discount saves more (only one applies per order).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
