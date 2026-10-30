# Act Avenue

Ticketing, cast and crew profiles, and show pages for Act Avenue. Live at actavenue.org.

Setup steps live in `SETUP.md`. Image replacement notes live in `public/images/README.txt`. This file describes what the project is, how it is built, and what each kind of account can do.

Keep this file current. When a feature is added, changed or removed, update the matching section here and add a line to the Change log at the bottom.

---

## 1. Stack and hosting

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, Bootstrap Icons, self-hosted fonts (Inter, Playfair Display, Lora, Courier Prime, Caveat) |
| Database and auth | Supabase (Postgres with row level security, Auth, Storage) |
| Email | Resend |
| Hosting | Vercel (function region Tokyo, hnd1, same region as the Supabase project) |
| Other libraries | `qrcode` (ticket QR), `jsqr` (in-browser scanner), `zod` |

Next.js 16 has breaking changes from older versions. Read the guides in `node_modules/next/dist/docs/` before changing framework-level code. `proxy.ts` replaces the old middleware.

### Environment variables

Names only. Values live in `.env.local` and the Vercel project settings.

| Name | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (anon) key, used by browser and public pages |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only key for admin and API routes |
| `RESEND_API_KEY` | Sending email |
| `EMAIL_FROM` | Sender, for example `Act Avenue <tickets@yourdomain>` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for share previews and email links (falls back to https://www.actavenue.org) |
| `CRON_SECRET` | Protects `/api/cron/hold-expiry` |

### Storage buckets (Supabase)

`payment-proofs`, `e-tickets`, `production-media` (public), and `id-proofs` (private, discounted ticket IDs, staff view only).

### Scheduled job

`vercel.json` runs `/api/cron/hold-expiry` once a day (Hobby plan limit). It sends a reminder about 12 hours before a payment hold ends and releases seats for holds that have expired.

### Vercel plan limits that shape the code

The site runs on the Hobby plan. Image optimization is capped at 5,000 transformations a month, so `next.config.ts` limits image sizes and caches optimized images for 31 days. Public pages are cached for 60 seconds (see Performance and caching).

---

## 2. Project layout

```
app/
  (site)/            Public site: home, shows, plays, cast and crew, cart, checkout,
                     order and reservation pages, ticket page (t), about, contact, account, unsubscribe
  admin/(protected)/ Admin area, gated by a server layout
  admin/login/       Admin sign in (outside the gate on purpose)
  api/               Route handlers: account, admin, cart, checkin, checkout, cron,
                     promo, reservation, subscribe, unsubscribe
components/          UI. components/admin holds admin-only pieces
lib/                 Shared logic: access rules, pricing, tiers and seat pools,
                     inventory, email, QR, dates, uploads, mailing, share metadata
lib/data/            Read helpers for public pages (cookie-free, cacheable)
lib/supabase/        Browser, server, service (admin) and public (anon) clients
supabase/            schema.sql (full schema) plus one migration file per change
types/database.ts    Shared row types
proxy.ts             Session refresh for protected paths only
```

---

## 3. Data model (summary)

- `organizations`: owners of productions (name, logo).
- `productions`: title, slug, description, poster, banner, status (`draft`, `published`, `closed`), payment details (GCash, bank, QR images), email note.
- `performances`: a show date under a production (label, date and time, venue, capacity).
- `ticket_tiers`: per performance. Fields: tier type (`regular`, `vip`, `discounted`, `special`), display name, price, quantity, held count, inclusions text, ID requirement, optional time-limited price window, optional link to a main tier (shared seats) with an optional own cap.
- `reservations` and `reservation_items`: a booking and its ticket lines. Status values: `pending_review`, `confirmed`, `rejected`, `expired`. Items track scans used and the uploaded ID.
- `carts` and `cart_items`: a visitor's cart (guest or signed in).
- `promo_codes`: per organization, optionally limited to one production, to ticket types, and to a number of uses.
- `profiles`: one per account. Role is `public`, `actor`, `organizer` or `admin`. Cast and crew fields: bio, bio style, photo, links, resume, reel, public listing flags.
- `actor_photos`: extra gallery photos per profile (up to 9).
- `production_credits` and `production_plays`: who is credited on a production, and which plays it stages.
- `plays` and `play_writers`: the play catalog (title, tagline, description, photo, writers).
- `production_staff`: per production assignment of a person as `manager`, `foh` or `scanner`.
- `production_partners`: sponsors, media partners and organizations shown on a production.
- `scan_log`: one row for every admit at the door.
- `subscribers` and `mailing_campaigns`: mailing list and sent campaigns.

`supabase/schema.sql` is kept in sync with every migration. New tables need explicit grants (service role full access, plus select for anon and authenticated if the data is public).

### Migrations

Each file in `supabase/` named `migration-*.sql` is a one-time change run by hand in the Supabase SQL editor. Current files, oldest topics first:

`migration-tiers-partners`, `migration-orders`, `migration-payment-details`, `migration-ticket-qr`, `migration-promo-uses`, `migration-credits-plays`, `migration-play-catalog`, `migration-dancers`, `migration-carousel-order`, `migration-profile-links-email-notes`, `migration-staff-profiles`, `migration-production-staff`, `migration-scanner-role`, `migration-bio-style-play-writers`, `migration-dashboard-mailing`, `migration-play-logline`, `migration-shared-pools`, `migration-multi-id`. Also: `fix-patlangreschedule-uses.sql` (one-off data fix) and the `seed-*.sql` files (sample data).

---

## 4. Features

### Public site
- Home page with show carousel and an About section that links to the About us page.
- About us page (`/about`): the group's story, links to Shows, Plays and Cast & Crew, and ways to get in touch.
- Navbar for visitors and members: Shows, Plays, Cast & Crew, About us, Contact us, then account links (Admin or Scan for staff, My Tickets, My Profile, Sign out, or Sign in and Sign up), then the Cart button. It collapses into a menu below 1280 px wide.
- Shows: one page per published production with poster, banner, description, plays staged, cast and crew, partners, and a ticket picker. Share button on every show.
- Ticket picker: choose a date, then tickets. Seats left update live as others buy.
- Plays: catalog of Act Avenue plays with photo (shown uncropped up to 4:5 on the play page), tagline, writers, description, and every production that staged it, split into Now Showing and Past Showings. Share and Copy link buttons on each play.
- Cast and Crew: public profiles with photo, formatted bio, links, resume and reel, gallery of up to 9 photos, and production history.
- Link previews: shows, plays and profiles carry share metadata for Facebook, Messenger, Viber, X and similar.
- Footer: social links, tagline "Ang Paborito Mong Tambayan.", mailing list sign up, and links to Contact us and the Data Privacy Notice.
- Contact us page (`/contact`): name, email, optional phone, subject and message. Messages are emailed to jomari.jacinto@actavenue.org with the sender's address as the reply-to. Includes a hidden bot trap and a limit of 5 messages an hour per visitor.

### Buying tickets
- Cart works for guests and signed in people. The cart icon shows for signed in visitors, or for guests with items.
- Sign in and sign up open in a centered modal from the navbar.
- Ticket types: Regular, VIP, Discounted, Special. A tier can carry a display name such as "Early Bird".
- Discounted tiers can require an ID upload (Student, PWD, Senior) before the tickets are added to the cart. One ID is required for each ticket (buying 3 asks for 3 IDs). IDs go to a private bucket. Lowering the quantity in the cart drops the extra IDs. Raising it means adding tickets again from the show page with their IDs.
- Shared seats: a tier can draw seats from a main tier on the same show (for example Regular 50 with Discounted drawing from it). The linked tier can have its own cap or use only the shared total.
- Promo codes: percent or fixed amount off per ticket, limited by production, ticket type, expiry and number of uses. One code per reservation. Codes do not stack with time-limited tier pricing.
- Checkout: buyer details, a required Data Privacy consent box, optional mailing list opt-in, and payment instructions (GCash or bank, with QR) set per production. Seats are held for 24 hours while payment is reviewed.
- Payment proof upload with re-upload if it is rejected. A reminder email goes out before the hold ends. Expired holds release seats.
- After approval the buyer gets an email with an e-ticket and QR code, and a ticket page they can open on the day.
- Guests get a prompt to create an account after checkout. Signed in buyers see "My tickets".

### Door and check-in
- QR scanner in the browser (camera). Scans are accepted from one hour before to three hours after show start. Managers and admins can override the window.
- Tickets can be admitted one at a time or all at once, and each admit is logged with the staff member.
- Manual check-in for people without their QR code.
- Check-in report per show: totals, by staff, arrivals in 15 minute steps, a timeline, and a CSV export.

### Admin tools
- Dashboard: revenue, tickets sold, pending payments, online versus walk-in, per show seat bars, attendance and no-shows, sales by booking day, bookings by status, and promo use. Tickets are listed most expensive first. The Pending card opens Pending Review reservations.
- Reservations: search by name, email, phone, reference code or order code, filter by production and show, status tabs with counts, approve, reject, reopen, edit quantities, review ID uploads, resend the confirmation email, transfer to another show, delete.
- New reservation: staff can book on behalf of a buyer.
- Sales: summary by production, show and ticket type. CSV exports.
- Productions: details, media, payment details, performances and tiers, plays staged, credits, partners, publish status. Staged "Save changes" bar on edit forms.
- Plays: catalog with photo, tagline, description and writers. Adding a writer to a play credits them automatically on any production that stages it.
- Organizations: names and logos.
- People: all accounts in tabs (pending, members, audience, and others), search across everyone, bulk approve, take down, and add to Cast and Crew, joined date and booking counts.
- Mailing list: subscribers, manual add, test send, and campaign send in batches. Every email carries an unsubscribe link and one click unsubscribe headers.
- Staff assignment per production (Manager, FOH, Scanner).

### Accounts and profiles
- Email sign up and sign in. Admin sign in has its own page.
- Profile settings: name, photo, bio with formatting (size, alignment, font, color, emoji), links, resume and reel, gallery.
- Request to join Cast and Crew. An admin reviews each request before the profile appears publicly.
- Account deletion.

### Interface conventions
- Philippine time (PHT) everywhere dates are shown or entered.
- Toast messages appear at the lower left.
- Admin edit forms stage changes and save together with a "Save changes" bar.
- Name dropdowns are alphabetized.
- Admin menu: grouped left sidebar on desktop (collapsible), grouped slide down menu on phones.
- Brand name is always "Act Avenue".

---

## 5. Roles: what each can and cannot do

There are two layers. The account role sets who you are on the site. Production staff assignments set what you can do on a specific production.

| Account role | Meaning |
|---|---|
| Visitor | Not signed in |
| Account (`public`) | Signed in, no cast or crew listing |
| Cast and Crew (`actor`) | Has a profile that can be listed publicly after approval |
| Admin or Organizer (`admin`, `organizer`) | Full access. Both roles are treated the same |

Production staff roles (set per production by an admin, on top of any account role): Manager, FOH (front of house), Scanner. A person can hold different roles on different productions. Staff only see the productions they are assigned to.

### Quick comparison

| Action | Scanner | FOH | Manager | Admin |
|---|---|---|---|---|
| Scan tickets | Yes | Yes | Yes | Yes |
| Scan outside the time window | No | No | Yes | Yes |
| Manual check-in | No | Yes | Yes | Yes |
| Dashboard | No | Yes | Yes | Yes |
| View reservations and sales, export | No | Yes | Yes | Yes |
| Approve, reject, reopen reservations | No | Yes | Yes | Yes |
| Edit ticket quantities, check ID uploads, resend email | No | Yes | Yes | Yes |
| Create a manual reservation | No | Yes | Yes | Yes |
| Transfer or delete a reservation | No | No | Yes | Yes |
| Edit production, shows, tiers, credits, partners | No | No | Yes | Yes |
| Promo codes | No | No | Yes | Yes |
| Check-in report | No | No | Yes | Yes |
| Create productions, organizations, plays | No | No | No | Yes |
| People approvals, mailing list, staff assignment | No | No | No | Yes |

Managers and FOH only reach productions they are assigned to. Admins reach all.

### Visitor
Can: browse shows, plays and cast and crew, build a cart, check out as a guest, open an order or ticket link from an email, subscribe to the mailing list, send a message through Contact us.
Cannot: see "My tickets", edit a profile, or enter the admin area.

### Account (signed in, not listed)
Can: everything a visitor can, plus see "My tickets", edit own profile settings, and request to join Cast and Crew.
Cannot: appear in the public Cast and Crew list or upload a gallery until approved as Cast and Crew.

### Cast and Crew
Can: edit the profile, formatted bio, links, resume and reel, main photo, and a gallery of up to 9 photos. Profile is public once an admin approves it.
Cannot: be listed without approval, change credits on a production, or edit plays. Credits, play writers and approval are handled by managers and admins. Writers credited on a play are added to productions staging it automatically.

### Scanner
Sees: Scan and My profile only.
Can: scan tickets for assigned productions during the scan window and choose to admit one or all tickets on a booking.
Cannot: scan outside the window, check people in manually, see reservations, sales or the dashboard, or change anything.

### FOH (front of house)
Sees: Dashboard, Reservations, New reservation, Sales, Scan, Manual check-in, My profile.
Can: review payments and approve or reject, reopen a rejected or expired booking, edit ticket quantities, check ID uploads, resend confirmation emails, make bookings for buyers, check people in by hand, export data.
Cannot: edit productions, shows or tiers, manage promo codes, transfer or delete a reservation, see the check-in report, or override the scan window.

### Manager
Sees: everything FOH sees, plus Promo codes, Check-in report and My productions.
Can: edit the production page, media, payment details, shows and ticket tiers (including shared seats), credits and partners for assigned productions. Create promo codes for them, transfer or delete reservations, view the check-in report, and override the scan window.
Cannot: create new productions, manage organizations or the plays catalog, approve people, send mailing list emails, or assign staff.

### Admin and Organizer
Can: everything. Create productions and organizations, manage the plays catalog, approve and take down Cast and Crew, add audience accounts to Cast and Crew, assign Manager, FOH and Scanner roles, run the mailing list, and reach every production's data.
Notes: admin status is set by a database change, not from the site (see `SETUP.md`). The site never lets an account promote itself beyond Cast and Crew.

---

### Data privacy
- The Data Privacy Notice follows the Data Privacy Act of 2012 (RA 10173). It opens in a centered box (same style as sign in) from the checkout, the contact form and the footer link. The text lives in `components/privacy-notice.tsx`.
- A consent box with a link to the notice is required on the contact form and at checkout. The server also rejects submissions without it. The footer carries a link to the notice next to Contact us.
- The notice should be reviewed by the organization's legal adviser or data protection officer before relying on it.

## 6. Performance and caching

- Public pages (home, shows, plays, cast and crew) read through a cookie-free Supabase client so they can be cached. They revalidate every 60 seconds.
- Admin and account write routes call `revalidatePath` after a successful change, so edits show on the public site on the next visit.
- Seat holds, carts and checkout are never cached.
- The ticket picker reads live tier rows on load and subscribes to realtime changes, so counts stay correct even when the page came from cache.
- Seat counts use a database function (`hold_ticket_tier`) that locks the seat pool and checks it in one step, so two buyers cannot take the last seat.
- `proxy.ts` only runs on `/admin`, `/api`, `/account`, `/checkout`, `/cart`, `/reservation`, `/order` and `/t`.

## 7. Security notes

- Row level security is on for every table. The browser and public pages only get what the policies allow.
- Admin and staff routes check access on the server with helpers in `lib/admin-auth.ts` (`requireStaff`, `requireProduction`, `requireAnyAccess`, `requireAdminPage`). UI hiding is never the only gate.
- The service role key is used only in server code.
- Uploaded IDs and payment proofs sit in non-public buckets or behind staff-only routes.
- Mailing list sign up and the contact form have a hidden honeypot field, and the contact form is rate limited. Cron endpoints require `CRON_SECRET`.

---

## Change log

Newest first. Add a line for each feature or behavior change.

- One ID per discounted ticket: the ID upload asks for as many IDs as tickets, checkout checks the count, and staff can open each ID.
- Reservations search and production and show filters, status tab counts, and a mobile fix so the status tabs wrap instead of overflowing.
- About us page, Contact us in the navbar, and a reordered navbar (browse, info, account, cart).
- Contact us page that emails the team, plus a Data Privacy Notice (RA 10173) with required consent at checkout and on the contact form, and a notice link in the footer.
- Shared seat pools: a tier can draw seats from a main tier, with an optional own cap.
- Gallery limit raised from 8 to 9. Sharper thumbnails and headshots.
- Play tagline and Share / Copy link buttons on play pages.
- Dashboard Pending card links to Pending Review reservations. Dashboard tickets sorted by price.
- Admin menu grouped, with matching headings on phone and desktop.
- People page rebuilt: tab counts, cross-group search, sorting, paging, bulk add to Cast and Crew.
- Dashboard, check-in report, mailing list, share previews.
- Play writers with automatic production credits. Bio formatting.
- Caching and performance pass, Tokyo function region.
- Discounted tier ID upload flow.
