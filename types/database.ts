// Hand-written types mirroring supabase/schema.sql.
// Once the schema stabilizes, swap these for generated types:
//   supabase gen types typescript --project-id <id> > types/database.generated.ts

export type ProductionStatus = "draft" | "published" | "closed";
export type PaymentStatus = "pending_review" | "confirmed" | "rejected" | "expired";
export type BookingSource = "public" | "admin_manual";
export type DiscountType = "percent" | "fixed";
export type ProfileRole = "admin" | "organizer" | "actor" | "public";

export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  role: ProfileRole;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  photo_url: string | null;
  resume_url: string | null;
  reel_url: string | null;
  is_public: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface ActorPhoto {
  id: string;
  profile_id: string;
  photo_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductionCredit {
  id: string;
  profile_id: string;
  production_id: string;
  role_played: string;
  section: "artistic" | "production";
  credit_type: "writer" | "director" | "actor" | null;
  play_id: string | null;
  sort_order: number;
  is_discredited: boolean;
  created_at: string;
}

export interface Play {
  id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface Production {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  description: string | null;
  poster_url: string | null;
  banner_url: string | null;
  status: ProductionStatus;
  created_at: string;
  updated_at: string;
}

export interface Performance {
  id: string;
  production_id: string;
  label: string;
  datetime: string;
  venue: string;
  capacity: number;
  created_at: string;
}

export interface TicketTier {
  id: string;
  performance_id: string;
  label: string;
  price: number;
  quantity_available: number;
  quantity_held: number;
  is_discount_tier: boolean;
  discount_valid_from: string | null;
  discount_valid_until: string | null;
  created_at: string;
}

export interface PromoCode {
  id: string;
  organization_id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  applies_to_production_id: string | null;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  created_at: string;
}

export interface Cart {
  id: string;
  session_token: string;
  email: string | null;
  status: "active" | "converted" | "expired";
  created_at: string;
  expires_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  performance_id: string;
  ticket_tier_id: string;
  quantity: number;
  created_at: string;
}

export interface Reservation {
  id: string;
  production_id: string;
  performance_id: string;
  reference_code: string;
  profile_id: string | null;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  promo_code_id: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_status: PaymentStatus;
  booking_source: BookingSource;
  payment_proof_url: string | null;
  qr_code_url: string | null;
  booking_email_sent_at: string | null;
  approval_email_sent_at: string | null;
  rejection_email_sent_at: string | null;
  reminder_email_sent_at: string | null;
  rejection_reason: string | null;
  reopened_at: string | null;
  hold_expires_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationItem {
  id: string;
  reservation_id: string;
  ticket_tier_id: string;
  quantity: number;
  unit_price: number;
}

// ---- Composite view types used by the UI ----

export interface TierWithAvailability extends TicketTier {
  remaining: number; // quantity_available - quantity_held
  discount_active: boolean;
}

export interface PerformanceWithTiers extends Performance {
  ticket_tiers: TierWithAvailability[];
}

export interface ProductionWithPerformances extends Production {
  performances: PerformanceWithTiers[];
}

export interface CartItemWithDetails extends CartItem {
  ticket_tier: TicketTier;
  performance: Performance;
}

export interface ReservationWithItems extends Reservation {
  reservation_items: (ReservationItem & { ticket_tier: TicketTier })[];
  performance: Performance;
  production: Production;
}
