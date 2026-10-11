-- Per-production payment details (GCash, bank, QR images).
-- Blank fields fall back to the defaults in lib/payment.ts and the placeholder QR images.
alter table productions
  add column if not exists gcash_name text,
  add column if not exists gcash_number text,
  add column if not exists gcash_qr_url text,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_qr_url text;
