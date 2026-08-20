/**
 * Public storefront API client (2A). Deliberately standalone — it does NOT use
 * the shared authed `axios` client, because storefront pages are public and must
 * never send the workspace bearer token nor trigger the app's 401→/login
 * redirect. Requests either send no auth (catalog, OTP) or the short-lived
 * customer OTP token minted by the backend after phone verification.
 */
import { API_BASE_URL, endpoints } from "./endpoints";

export class StorefrontError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "StorefrontError";
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers ?? undefined);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (body && (body.message || body.error)) ||
      `Request failed (${res.status})`;
    throw new StorefrontError(Array.isArray(msg) ? msg.join(", ") : String(msg), res.status);
  }
  return body as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Cadence = "DAILY" | "WEEKDAYS" | "CUSTOM";

export interface StorefrontProduct {
  productId: string;
  name: string;
  variant: string | null;
  price: string;
  quantity: number;
}
/**
 * FIXED  — customer receives the whole bundle, no choice.
 * SINGLE — a menu: pick exactly one item.
 * MULTI  — "make your own bundle": any combination, any quantity.
 */
export type PlanSelectionMode = "FIXED" | "SINGLE" | "MULTI";

export interface StorefrontPlan {
  id: string;
  name: string;
  description: string | null;
  selectionMode: PlanSelectionMode;
  products: StorefrontProduct[];
}
export interface StorefrontWindow {
  id: string;
  weekday: number; // 0=Sun..6=Sat
  startTime: string;
  endTime: string;
  label: string | null;
}
export interface StorefrontCatalog {
  currency: string;
  timezone: string;
  deliveryFee: string;
  plans: StorefrontPlan[];
  windows: StorefrontWindow[];
  /** DEMO-ONLY: storefront runs without real WhatsApp (OTP + reminders faked). */
  demoMode?: boolean;
}

export interface CustomerSubscription {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  cadence: Cadence;
  daysOfWeek: number[];
  startDate: string;
  plan: { id: string; name: string };
  product: { id: string; name: string; variant: string | null } | null;
  deliveryWindow: StorefrontWindow | null;
}
export interface CustomerMe {
  subscriptions: CustomerSubscription[];
  wallet: { contactId: string; balance: string };
}

export interface SubscribeInput {
  planId: string;
  productId?: string;
  /** MULTI plans only — the customer's chosen breads and quantities. */
  items?: { productId: string; quantity: number }[];
  cadence: Cadence;
  daysOfWeek?: number[];
  deliveryWindowId?: string;
  startDate: string; // YYYY-MM-DD
}

export interface PayOrder {
  orderId: string;
  amount: number; // minor units
  currency: string;
  periods: number;
  keyId?: string;
}

// ── Client ──────────────────────────────────────────────────────────────────

export const storefrontApi = {
  catalog: (handle: string) => call<StorefrontCatalog>(endpoints.recurring.public.catalog(handle)),

  requestOtp: (handle: string, phone: string) =>
    // DEMO-ONLY: a demo storefront has no verified WABA, so no code can actually
    // be delivered. The API returns the session token here instead and the code
    // screen is skipped entirely.
    call<{
      sent: true;
      expiresInSec: number;
      token?: string;
      contactId?: string;
    }>(endpoints.recurring.public.otpRequest(handle), {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (handle: string, phone: string, code: string) =>
    call<{ token: string; contactId: string; expiresIn: string }>(
      endpoints.recurring.public.otpVerify(handle),
      { method: "POST", body: JSON.stringify({ phone, code }) },
    ),

  me: (handle: string, token: string) =>
    call<CustomerMe>(endpoints.recurring.public.me(handle), {}, token),

  subscribe: (handle: string, token: string, input: SubscribeInput) =>
    call<CustomerSubscription>(
      endpoints.recurring.public.subscribe(handle),
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  update: (handle: string, token: string, id: string, patch: Partial<SubscribeInput>) =>
    call<CustomerSubscription>(
      endpoints.recurring.public.subscriptionById(handle, id),
      { method: "PATCH", body: JSON.stringify(patch) },
      token,
    ),

  skip: (handle: string, token: string, id: string, date: string) =>
    call(endpoints.recurring.public.skip(handle, id), {
      method: "POST",
      body: JSON.stringify({ date }),
    }, token),

  pause: (handle: string, token: string, id: string) =>
    call(endpoints.recurring.public.pause(handle, id), { method: "POST" }, token),

  resume: (handle: string, token: string, id: string) =>
    call(endpoints.recurring.public.resume(handle, id), { method: "POST" }, token),

  cancel: (handle: string, token: string, id: string) =>
    call(endpoints.recurring.public.cancel(handle, id), { method: "POST" }, token),

  pay: (handle: string, token: string, id: string, periods = 1) =>
    call<PayOrder>(endpoints.recurring.public.pay(handle, id), {
      method: "POST",
      body: JSON.stringify({ periods }),
    }, token),
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
