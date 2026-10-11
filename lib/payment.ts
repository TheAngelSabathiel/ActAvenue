import { IMAGES } from "@/lib/images";

/**
 * Default payment details, used when a production leaves its own blank.
 * Each production can override these in Admin > Productions > Payment details.
 * Default QR images live in /public/images (payment-gcash-qr.png, payment-bank-qr.png).
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

export type PaymentDetails = {
  gcash: { name: string; number: string; qr: string };
  bank: { bankName: string; accountName: string; accountNumber: string; qr: string };
};

type ProductionPaymentFields = {
  gcash_name?: string | null;
  gcash_number?: string | null;
  gcash_qr_url?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_qr_url?: string | null;
};

/** A production's payment details with any blank field filled from the defaults. */
export function resolvePayment(p: ProductionPaymentFields | null | undefined): PaymentDetails {
  return {
    gcash: {
      name: p?.gcash_name || PAYMENT.gcash.name,
      number: p?.gcash_number || PAYMENT.gcash.number,
      qr: p?.gcash_qr_url || IMAGES.paymentGcash,
    },
    bank: {
      bankName: p?.bank_name || PAYMENT.bank.bankName,
      accountName: p?.bank_account_name || PAYMENT.bank.accountName,
      accountNumber: p?.bank_account_number || PAYMENT.bank.accountNumber,
      qr: p?.bank_qr_url || IMAGES.paymentBank,
    },
  };
}

/** One payee in the checkout: the shows paid to the same account, and what is owed there. */
export type PaymentGroup = { titles: string[]; total: number; details: PaymentDetails };
