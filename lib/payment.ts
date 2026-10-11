/**
 * Payment details shown on the checkout page.
 * Replace the placeholders with the real numbers and names.
 * QR images live in /public/images (payment-gcash-qr.png, payment-bank-qr.png).
 */
export const PAYMENT = {
  gcash: {
    name: "Act Avenue",
    number: "09XX XXX XXXX",
  },
  bank: {
    bankName: "BANK NAME",
    accountName: "Act Avenue",
    accountNumber: "0000 0000 0000",
  },
} as const;
