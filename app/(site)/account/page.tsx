import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccountReservations } from "@/lib/data/account";
import { formatDateTime } from "@/lib/datetime";

const STATUS_STYLE: Record<string, string> = {
  pending_review: "bg-accent text-black",
  confirmed: "bg-success text-white",
  rejected: "bg-danger text-white",
  expired: "bg-soft text-muted border border-[#dee2e6]",
};

export default async function AccountPage() {
  const result = await getAccountReservations();
  if (!result) redirect("/account/login");

  const { user, reservations, fetchedAt } = result;
  // "Past" = the show date has already happened, or the booking never went
  // anywhere (rejected/expired) - matters for "productions attended
  // historically" being about the actual show, not just payment status. A
  // confirmed booking for a show that already happened belongs in Past,
  // not sitting in Upcoming forever. Uses fetchedAt (computed once in the
  // data layer) rather than calling Date.now() here during render.
  const isPast = (r: (typeof reservations)[number]) =>
    r.payment_status === "expired" ||
    r.payment_status === "rejected" ||
    new Date(r.performance.datetime).getTime() < fetchedAt;
  const upcoming = reservations.filter((r) => !isPast(r));
  const past = reservations.filter(isPast);

  return (
    <div className="aa-container max-w-2xl py-12">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl mb-0">My Tickets</h1>
        <Link href="/account/settings" className="aa-btn aa-btn-outline aa-btn-sm">Settings</Link>
      </div>
      <hr className="aa-divider" />
      <p className="text-sm text-muted mb-8">{user.email}</p>

      {reservations.length === 0 && (
        <div className="aa-card p-10 text-center">
          <p className="font-bold uppercase tracking-[0.08em] mb-4">No tickets yet</p>
          <Link href="/#now-showing" className="aa-btn">Browse Shows</Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-4 mb-10">
          {upcoming.map((r) => <ReservationCard key={r.id} reservation={r} />)}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-xl mb-4 text-muted">Past</h2>
          <div className="space-y-4">
            {past.map((r) => <ReservationCard key={r.id} reservation={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationCard({
  reservation: r,
}: {
  reservation: {
    id: string;
    reference_code: string;
    payment_status: string;
    production: { title: string };
    performance: { label: string; datetime: string; venue: string };
    total: number;
    reservation_items: { id: string; quantity: number; ticket_tier: { label: string } }[];
  };
}) {
  return (
    <Link
      href={`/reservation/${r.reference_code}`}
      className="aa-card aa-lift p-5 block"
    >
      <span
        className={`aa-label inline-block px-2 py-0.5 mb-2 ${STATUS_STYLE[r.payment_status]}`}
      >
        {r.payment_status.replace("_", " ")}
      </span>
      <p className="font-black text-lg mb-1">{r.production.title}</p>
      <p className="font-bold mb-0">{r.performance.label}</p>
      <p className="text-sm mb-0">
        <i className="bi bi-calendar-event" /> {formatDateTime(r.performance.datetime)}
      </p>
      <p className="text-sm mb-2">
        <i className="bi bi-geo-alt" /> {r.performance.venue}
      </p>
      <ul className="text-sm list-none p-0 m-0 mb-2">
        {r.reservation_items.map((i) => (
          <li key={i.id}>{i.quantity} × {i.ticket_tier.label}</li>
        ))}
      </ul>
      <p className="text-sm font-black mb-0">
        ₱{r.total.toFixed(2)} <span className="aa-label text-muted ml-2">Ref {r.reference_code}</span>
      </p>
    </Link>
  );
}
