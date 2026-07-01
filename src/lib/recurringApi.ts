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

  // Plans
  listPlans: async () => (await api.get<RecurringPlan[]>(endpoints.recurring.plans)).data,
  createPlan: async (dto: {
    name: string;
    description?: string;
    items: { productId: string; quantity: number }[];
  }) => (await api.post<RecurringPlan>(endpoints.recurring.plans, dto)).data,

  // Subscriptions
  listSubscriptions: async () =>
    (await api.get<RecurringSubscription[]>(endpoints.recurring.subscriptions)).data,
  getSubscription: async (id: string) =>
    (await api.get<RecurringSubscriptionDetail>(endpoints.recurring.subscriptionById(id))).data,
  createSubscription: async (dto: {
    contactId: string;
    planId: string;
    cadence: Cadence;
    daysOfWeek?: number[];
    slot?: string;
    startDate: string;
  }) => (await api.post<RecurringSubscription>(endpoints.recurring.subscriptions, dto)).data,
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

  // Settings
  getSettings: async () => (await api.get<RecurringSettings>(endpoints.recurring.settings)).data,
  updateSettings: async (dto: Partial<RecurringSettings>) =>
    (await api.patch<RecurringSettings>(endpoints.recurring.settings, dto)).data,
};
