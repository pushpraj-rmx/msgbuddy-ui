/**
 * Merchant legal details backing the storefront policy pages.
 *
 * These pages exist because Razorpay requires a live, self-consistent set of
 * policies before issuing live API keys: the business name must match across the
 * site, and refund, contact, shipping and privacy pages must all be reachable.
 * Serving the msgbuddy platform's own /terms here fails that check — a reviewer
 * sees a bakery storefront with a SaaS company's terms on it.
 *
 * Anything marked TODO is a legal detail only the merchant can supply. Publishing
 * a guess is worse than publishing nothing: a wrong address or licence number on
 * a policy page is exactly what a reviewer rejects.
 */
export interface MerchantPolicy {
  legalName: string;
  brandName: string;
  proprietor?: string;
  email: string;
  phone: string;
  address: string;
  serviceAreas: string;
  fssai?: string;
  gstin?: string;
  /** Working days to return unused wallet balance after cancellation. */
  refundDays: number;
  /** Local time after which tomorrow's order is locked. */
  cutoffTime: string;
  updated: string;
}

export const MERCHANT_POLICIES: Record<string, MerchantPolicy> = {
  "sugar-artisan-bakery": {
    legalName: "Sugar Artisan Bakery",
    brandName: "Wholesome Bar Co.",
    proprietor: "Richa Aggarwal",
    email: "hello@wholesomebar.in", // TODO confirm a monitored mailbox
    phone: "+91 98186 26240", // TODO confirm the number to publish
    address: "New Delhi, India", // TODO full registered address incl. PIN
    serviceAreas: "South Delhi, Gurugram, Noida and Dwarka",
    fssai: undefined, // TODO licence number (her site cites one)
    gstin: undefined, // TODO if registered
    refundDays: 5,
    cutoffTime: "9:00 pm",
    updated: "21 August 2026",
  },
};

export function policyFor(handle: string): MerchantPolicy | null {
  return MERCHANT_POLICIES[handle] ?? null;
}
