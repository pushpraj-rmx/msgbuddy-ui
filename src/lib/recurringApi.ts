/**
 * API client for the recurring-commerce (customer subscriptions) module.
 * Mirrors the {data} envelope of the shared native-fetch client (src/lib/axios).
 * Money fields are strings (Prisma Decimal serialises to a string).
 */
import api from "./axios";
import { endpoints } from "./endpoints";

export type Cadence = "DAILY" | "WEEKDAYS" | "CUSTOM";
export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED";
export type CycleStatus =
  | "SCHEDULED"
  | "LOCKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "SKIPPED";

export interface RecurringProduct {
  id: string;
  sku: string;
  name: string;
  variant: string | null;
  price: string;
  active: boolean;
  createdAt: string;
}

export interface RecurringPlanItem {
  id: string;
  quantity: number;
  product: RecurringProduct;
}

export interface RecurringPlan {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  items: RecurringPlanItem[];
  createdAt: string;
}

export interface ContactRef {
  id: string;
  name: string | null;
  phone: string;
}

export interface RecurringSubscription {
  id: string;
  status: SubscriptionStatus;
  cadence: Cadence;
  daysOfWeek: number[];
  slot: string | null;
  startDate: string;
  contact: ContactRef;
  plan: { id: string; name: string };
  createdAt: string;
  /** Contact's current wallet balance (decimal string). */
  walletBalance: string;
}

export interface RecurringSubscriptionList {
  /** Workspace's low-balance line — at or under this reads "low". */
  lowBalanceThreshold: string;
  subscriptions: RecurringSubscription[];
}

export interface RecurringCycle {
  id: string;
  deliveryDate: string;
  status: CycleStatus;
  amount: string;
  fee: string;
  lockedAt: string | null;
}

export interface LedgerEntry {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: string;
  reason: string;
  cycleId: string | null;
  createdAt: string;
}

export interface Wallet {
  contactId: string;
  balance: string;
  ledger: LedgerEntry[];
}

export interface RecurringSubscriptionDetail extends RecurringSubscription {
  plan: RecurringPlan & { id: string; name: string };
  /** MULTI bundles: the customer's own composed lines. */
  items?: { quantity: number; product: { id: string; name: string; variant: string | null; price: string } }[];
  /** SINGLE plans: the one chosen product. */
  product?: { id: string; name: string; variant: string | null; price: string } | null;
  deliveryWindow?: { weekday: number; startTime: string; endTime: string; label: string | null } | null;
  cycles: RecurringCycle[];
  wallet: Wallet;
}

export interface ManifestRow {
  cycleId: string;
  status: CycleStatus;
  contact: string | null;
  phone: string;
  slot: string | null;
  items: unknown;
  amount: string;
}

export interface RecurringSettings {
  timezone: string;
  reminderTime: string;
  cutoffTime: string;
  deliveryFee: string;
  lowBalanceThreshold: string;
  refundSkipAsCredit: boolean;
  currency: string;
  reminderTemplateVersionId: string | null;
  lowBalanceTemplateVersionId: string | null;
  skipConfirmedTemplateVersionId: string | null;
  deliveredTemplateVersionId: string | null;
  otpTemplateVersionId: string | null;
  storefrontHandle: string | null;
  storefrontEnabled: boolean;
}

export interface DeliveryWindow {
  id: string;
  weekday: number; // 0=Sun..6=Sat
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  label: string | null;
  active: boolean;
}

export interface RazorpayStatus {
  workspaceId: string;
  connected: boolean;
  keyId: string | null;
  webhookConfigured: boolean;
}

export type ThemePreset = "WARM" | "MINIMAL" | "BOLD";

export interface StorefrontFeature {
  title: string;
  body: string;
}

export interface StorefrontBranding {
  displayName: string;
  tagline: string | null;
  accentColor: string | null;
  themePreset: ThemePreset;
  logoMediaId: string | null;
  logoUrl: string | null;
  heroImageMediaId: string | null;
  heroImageUrl: string | null;
  heroHeadline: string | null;
  aboutBody: string | null;
  features: StorefrontFeature[];
}

export const recurringApi = {
  // Products
  listProducts: async () =>
    (await api.get<RecurringProduct[]>(endpoints.recurring.products)).data,
  createProduct: async (dto: {
    sku: string;
    name: string;
    variant?: string;
    price: string;
    active?: boolean;
  }) => (await api.post<RecurringProduct>(endpoints.recurring.products, dto)).data,
  updateProduct: async (id: string, dto: Partial<{ name: string; variant: string; price: string; active: boolean }>) =>
    (await api.patch<RecurringProduct>(endpoints.recurring.productById(id), dto)).data,
  deleteProduct: async (id: string) =>
    (await api.delete<{ deleted: boolean }>(endpoints.recurring.productById(id))).data,

  // Plans
  listPlans: async () => (await api.get<RecurringPlan[]>(endpoints.recurring.plans)).data,
  createPlan: async (dto: {
    name: string;
    description?: string;
    items: { productId: string; quantity: number }[];
  }) => (await api.post<RecurringPlan>(endpoints.recurring.plans, dto)).data,
  updatePlan: async (id: string, dto: Partial<{ name: string; description: string; active: boolean }>) =>
    (await api.patch<RecurringPlan>(endpoints.recurring.planById(id), dto)).data,
  deletePlan: async (id: string) =>
    (await api.delete<{ deleted: boolean }>(endpoints.recurring.planById(id))).data,

  // Subscriptions
  listSubscriptions: async () =>
    (await api.get<RecurringSubscriptionList>(endpoints.recurring.subscriptions)).data,
  getSubscription: async (id: string) =>
    (await api.get<RecurringSubscriptionDetail>(endpoints.recurring.subscriptionById(id))).data,
  createSubscription: async (dto: {
    contactId: string;
    planId: string;
    productId?: string;
    cadence: Cadence;
    daysOfWeek?: number[];
    slot?: string;
    deliveryWindowId?: string;
    startDate: string;
  }) => (await api.post<RecurringSubscription>(endpoints.recurring.subscriptions, dto)).data,
  updateSubscription: async (
    id: string,
    dto: Partial<{
      planId: string;
      productId: string;
      cadence: Cadence;
      daysOfWeek: number[];
      slot: string;
      deliveryWindowId: string;
    }>,
  ) => (await api.patch<RecurringSubscription>(endpoints.recurring.subscriptionById(id), dto)).data,
  pause: async (id: string) =>
    (await api.post<RecurringSubscription>(endpoints.recurring.subscriptionPause(id))).data,
  resume: async (id: string) =>
    (await api.post<RecurringSubscription>(endpoints.recurring.subscriptionResume(id))).data,
  cancel: async (id: string) =>
    (await api.post<RecurringSubscription>(endpoints.recurring.subscriptionCancel(id))).data,

  // Wallet
  getWallet: async (contactId: string) =>
    (await api.get<Wallet>(endpoints.recurring.wallet(contactId))).data,
  topUp: async (contactId: string, amount: string, reason?: string) =>
    (await api.post<Wallet>(endpoints.recurring.walletTopUp(contactId), { amount, reason })).data,

  // Manifest + fulfilment
  manifest: async (date: string) =>
    (await api.get<ManifestRow[]>(endpoints.recurring.manifest, { params: { date } })).data,
  setCycleStatus: async (cycleId: string, status: "OUT_FOR_DELIVERY" | "DELIVERED") =>
    (await api.post<RecurringCycle>(endpoints.recurring.cycleStatus(cycleId), { status })).data,
  triggerGenerate: async (date?: string) =>
    (await api.post<{ enqueued: boolean; date: string }>(endpoints.recurring.triggerGenerate, { date })).data,
  triggerLock: async (date?: string) =>
    (await api.post<{ enqueued: boolean; date: string }>(endpoints.recurring.triggerLock, { date })).data,

  // Delivery windows (4A)
  listDeliveryWindows: async () =>
    (await api.get<DeliveryWindow[]>(endpoints.recurring.deliveryWindows)).data,
  createDeliveryWindow: async (dto: {
    weekday: number;
    startTime: string;
    endTime: string;
    label?: string;
    active?: boolean;
  }) => (await api.post<DeliveryWindow>(endpoints.recurring.deliveryWindows, dto)).data,
  updateDeliveryWindow: async (id: string, dto: Partial<Omit<DeliveryWindow, "id">>) =>
    (await api.patch<DeliveryWindow>(endpoints.recurring.deliveryWindowById(id), dto)).data,
  deleteDeliveryWindow: async (id: string) =>
    (await api.delete<{ deleted: boolean }>(endpoints.recurring.deliveryWindowById(id))).data,

  // Per-merchant Razorpay (3B)
  razorpayStatus: async () =>
    (await api.get<RazorpayStatus>(endpoints.recurring.razorpayStatus)).data,
  connectRazorpay: async (dto: { keyId: string; keySecret: string; webhookSecret: string }) =>
    (await api.post<RazorpayStatus>(endpoints.recurring.razorpayConnect, dto)).data,
  disconnectRazorpay: async () =>
    (await api.delete<RazorpayStatus>(endpoints.recurring.razorpayDisconnect)).data,

  // Settings
  getSettings: async () => (await api.get<RecurringSettings>(endpoints.recurring.settings)).data,
  updateSettings: async (dto: Partial<RecurringSettings>) =>
    (await api.patch<RecurringSettings>(endpoints.recurring.settings, dto)).data,

  // Storefront branding (white-label)
  getBranding: async () =>
    (await api.get<StorefrontBranding>(endpoints.recurring.branding)).data,
  updateBranding: async (
    dto: Partial<{
      displayName: string;
      tagline: string;
      logoMediaId: string;
      heroImageMediaId: string;
      accentColor: string;
      themePreset: ThemePreset;
      heroHeadline: string;
      aboutBody: string;
      features: StorefrontFeature[];
    }>,
  ) => (await api.put<StorefrontBranding>(endpoints.recurring.branding, dto)).data,
};
