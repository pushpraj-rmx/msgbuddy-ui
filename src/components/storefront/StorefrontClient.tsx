"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Plus,
  Wallet,
} from "lucide-react";
import {
  storefrontApi,
  StorefrontError,
  WEEKDAY_LABELS,
  type Cadence,
  type CustomerMe,
  type StorefrontCatalog,
  type StorefrontPlan,
  type StorefrontWindow,
} from "@/lib/storefrontApi";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Step = "plan" | "configure" | "auth" | "success";
type Mode = "subscribe" | "manage";

function errMsg(e: unknown): string {
  if (e instanceof StorefrontError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function money(currency: string, amount: string | number) {
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${Number(amount).toFixed(2)}`;
}

function todayYmd(tz?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/* ── Merchant brand (derived from handle until real branding lands, Part D) ──
   Gives each storefront a distinct, deterministic accent + monogram without any
   backend fields. The hue is exposed as `--brand` on the storefront root and
   consumed by the hero + monogram via color-mix, so it stays legible in every
   theme. */
function brandFromHandle(handle: string) {
  const name = handle.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { name, initials, hue };
}

async function openRazorpay(
  order: { orderId: string; amount: number; currency: string; keyId?: string },
  opts: { name: string; contact?: string },
  onPaid: () => void,
): Promise<boolean> {
  if (!order.keyId) return false;
  const ok = await new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  if (!ok || !(window as any).Razorpay) return false;
  const rzp = new (window as any).Razorpay({
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: opts.name,
    description: "Subscription payment",
    prefill: { contact: opts.contact },
    theme: { color: "#6EA8FE" },
    handler: () => onPaid(),
  });
  rzp.open();
  return true;
}

export default function StorefrontClient({ handle }: { handle: string }) {
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("subscribe");
  const [token, setToken] = useState<string | null>(null);

  const brand = useMemo(() => brandFromHandle(handle), [handle]);

  useEffect(() => {
    setToken(localStorage.getItem(`mb_sf_token:${handle}`));
  }, [handle]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await storefrontApi.catalog(handle));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const saveToken = useCallback(
    (t: string | null) => {
      setToken(t);
      if (t) localStorage.setItem(`mb_sf_token:${handle}`, t);
      else localStorage.removeItem(`mb_sf_token:${handle}`);
    },
    [handle],
  );

  // Expose the merchant hue as `--brand` for the whole subtree.
  const brandStyle = { ["--brand" as any]: `hsl(${brand.hue} 72% 55%)` } as React.CSSProperties;

  if (loading)
    return (
      <div style={brandStyle}>
        <CatalogSkeleton />
      </div>
    );

  if (error || !catalog) {
    return (
      <div style={brandStyle} className="space-y-4 pt-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-base-300 bg-base-200">
          <AlertCircle className="h-6 w-6 text-error" />
        </div>
        <p className="text-sm text-error">{error ?? "Storefront not found."}</p>
        <button className="btn btn-sm btn-primary" onClick={() => void loadCatalog()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={brandStyle} className="space-y-6">
      <Header brand={brand} />

      <div
        role="tablist"
        className="grid grid-cols-2 gap-1 rounded-box border border-base-300 bg-base-200/60 p-1"
      >
        {(["subscribe", "manage"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`rounded-[calc(var(--radius-box)-0.25rem)] px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-base-100 text-base-content shadow-sm"
                : "text-base-content/55 hover:text-base-content"
            }`}
            onClick={() => setMode(m)}
          >
            {m === "subscribe" ? "Subscribe" : "My deliveries"}
          </button>
        ))}
      </div>

      {mode === "subscribe" ? (
        <SubscribeFlow
          handle={handle}
          catalog={catalog}
          token={token}
          onToken={saveToken}
          onManage={() => setMode("manage")}
        />
      ) : (
        <ManageView
          handle={handle}
          catalog={catalog}
          token={token}
          onToken={saveToken}
          onGoSubscribe={() => setMode("subscribe")}
        />
      )}
    </div>
  );
}

/**
 * DEMO-ONLY: a mock of the daily WhatsApp reminder so a viewer sees the
 * "updates" part of the flow without a verified WABA / approved template.
 */
function WhatsAppReminderPreview({ brandName }: { brandName: string }) {
  return (
    <div className="mt-2 space-y-1.5 text-left">
      <p className="text-center text-[0.6875rem] uppercase tracking-wide text-base-content/40">
        Preview · the daily WhatsApp your customers get
      </p>
      <div className="rounded-2xl rounded-tl-sm border border-base-300 bg-[#dcf8c6] p-3 text-[0.8125rem] text-neutral-800 shadow-sm">
        <p className="font-semibold">{brandName}</p>
        <p className="mt-1">
          🥖 Your delivery for tomorrow is scheduled — Daily Bread Box (₹215).
          Reply to confirm, skip or pause.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {["Confirm", "Skip tomorrow", "Pause"].map((b) => (
            <span
              key={b}
              className="rounded-md bg-white/70 px-1.5 py-1 text-center text-[0.6875rem] font-medium text-sky-700"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
      <p className="text-center text-[0.625rem] text-base-content/40">
        In production these taps update the subscription automatically — try
        Skip/Pause live under “My deliveries”.
      </p>
    </div>
  );
}

function Header({ brand }: { brand: ReturnType<typeof brandFromHandle> }) {
  return (
    <div className="op-grain relative overflow-hidden rounded-2xl border border-base-300 bg-base-200 p-6">
      {/* brand-tinted wash — theme-safe via color-mix over the base surface */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--brand) 22%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--brand) 90%, black 6%), color-mix(in oklab, var(--brand) 60%, black 22%))",
          }}
        >
          {brand.initials || "🛍"}
        </div>
        <div className="min-w-0">
          <span className="op-label">Subscriptions</span>
          <h1 className="truncate font-serif text-3xl leading-tight tracking-tight">
            {brand.name}
          </h1>
        </div>
      </div>
      <p className="relative mt-3 text-sm text-base-content/65">
        Fresh, delivered on your schedule — pause, skip or change anytime.
      </p>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="skeleton h-11 w-full rounded-box" />
      <div className="skeleton h-36 w-full rounded-2xl" />
      <div className="skeleton h-36 w-full rounded-2xl" />
    </div>
  );
}

/* ── Subscribe flow ──────────────────────────────────────────────────────── */

function SubscribeFlow({
  handle,
  catalog,
  token,
  onToken,
  onManage,
}: {
  handle: string;
  catalog: StorefrontCatalog;
  token: string | null;
  onToken: (t: string | null) => void;
  onManage: () => void;
}) {
  const [step, setStep] = useState<Step>("plan");
  const [planId, setPlanId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayYmd(catalog.timezone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = catalog.plans.find((p) => p.id === planId) ?? null;
  const product = plan?.products.find((pr) => pr.productId === productId) ?? null;
  const openWeekdays = useMemo(
    () => [...new Set(catalog.windows.map((w) => w.weekday))].sort((a, b) => a - b),
    [catalog.windows],
  );
  const perDelivery = product
    ? Number(product.price) * product.quantity + Number(catalog.deliveryFee)
    : 0;

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  }

  async function createSubscription(customerToken: string) {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const cadence: Cadence = days.length === 7 ? "DAILY" : "CUSTOM";
      const sub = await storefrontApi.subscribe(handle, customerToken, {
        planId: plan.id,
        productId: productId ?? undefined,
        cadence,
        daysOfWeek: cadence === "CUSTOM" ? days : undefined,
        deliveryWindowId: windowId ?? undefined,
        startDate,
      });
      // Kick off the first per-period payment (best-effort — the subscription
      // exists regardless; unpaid deliveries just won't lock until funded).
      try {
        const order = await storefrontApi.pay(handle, customerToken, sub.id, 1);
        await openRazorpay(order, { name: handle }, () => {});
      } catch {
        /* payment optional at signup; can pay from "My deliveries" */
      }
      setStep("success");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === "success") {
    return (
      <div className="space-y-4 rounded-2xl border border-success/30 bg-base-200 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-lg font-semibold">You&apos;re subscribed!</h2>
        <p className="mx-auto max-w-xs text-sm text-base-content/70">
          We&apos;ll send delivery reminders on WhatsApp. You can skip, pause or change your plan
          anytime.
        </p>
        <button className="btn btn-primary btn-block" onClick={onManage}>
          View my deliveries
        </button>
        {catalog.demoMode && (
          <WhatsAppReminderPreview brandName={brandFromHandle(handle).name} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepDots step={step} />
      {error && <Alert msg={error} />}

      {step === "plan" && (
        <div className="space-y-3">
          <SectionLabel>Choose a plan</SectionLabel>
          {catalog.plans.length === 0 && (
            <p className="text-sm text-base-content/60">No plans available right now.</p>
          )}
          {catalog.plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              currency={catalog.currency}
              selected={p.id === planId}
              onSelect={() => {
                setPlanId(p.id);
                setProductId(p.products[0]?.productId ?? null);
                setStep("configure");
              }}
            />
          ))}
        </div>
      )}

      {step === "configure" && plan && (
        <div className="space-y-6">
          <BackLink onClick={() => setStep("plan")}>Change plan</BackLink>

          <div>
            <SectionLabel>Pick your item</SectionLabel>
            <div className="mt-2.5 space-y-2">
              {plan.products.map((pr) => {
                const active = pr.productId === productId;
                return (
                  <label
                    key={pr.productId}
                    className={`flex cursor-pointer items-center justify-between rounded-box border p-3.5 transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-base-300 hover:border-base-content/25"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="product"
                        className="radio radio-sm radio-primary"
                        checked={active}
                        onChange={() => setProductId(pr.productId)}
                      />
                      <span>
                        <span className="font-medium">{pr.name}</span>
                        {pr.variant && (
                          <span className="text-base-content/50"> · {pr.variant}</span>
                        )}
                        {pr.quantity > 1 && (
                          <span className="text-base-content/50"> ×{pr.quantity}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[0.9375rem] font-semibold tabular-nums">
                      {money(catalog.currency, pr.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Delivery days</SectionLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, d) => {
                const open = openWeekdays.length === 0 || openWeekdays.includes(d);
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    disabled={!open}
                    title={open ? undefined : "Not available for delivery"}
                    onClick={() => toggleDay(d)}
                    className={`h-11 w-12 rounded-box border text-sm font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-content"
                        : open
                          ? "border-base-300 hover:border-base-content/25"
                          : "cursor-not-allowed border-dashed border-base-300 text-base-content/30"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {openWeekdays.length > 0 && openWeekdays.length < 7 && (
              <p className="mt-1.5 text-xs text-base-content/50">
                Dashed days aren&apos;t available for delivery.
              </p>
            )}
          </div>

          {catalog.windows.length > 0 && (
            <div>
              <SectionLabel>Delivery time</SectionLabel>
              <div className="mt-2.5 space-y-2">
                {dedupeWindows(catalog.windows).map((w) => {
                  const active = w.id === windowId;
                  return (
                    <label
                      key={w.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-box border p-3.5 transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-base-300 hover:border-base-content/25"
                      }`}
                    >
                      <input
                        type="radio"
                        name="window"
                        className="radio radio-sm radio-primary"
                        checked={active}
                        onChange={() => setWindowId(w.id)}
                      />
                      <Clock className="h-4 w-4 text-base-content/45" />
                      <span className="text-sm">
                        {w.label ? `${w.label} · ` : ""}
                        {w.startTime}–{w.endTime}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Start date</SectionLabel>
            <input
              type="date"
              className="input input-bordered mt-2.5 w-full"
              value={startDate}
              min={todayYmd(catalog.timezone)}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <OrderSummary currency={catalog.currency} perDelivery={perDelivery} days={days} />

          <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-base-100 via-base-100 to-transparent px-4 pb-2 pt-3">
            <button
              className="btn btn-primary btn-block"
              disabled={
                !productId || days.length === 0 || (catalog.windows.length > 0 && !windowId)
              }
              onClick={() => setStep("auth")}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "auth" && (
        <AuthStep
          handle={handle}
          existingToken={token}
          busy={busy}
          onBack={() => setStep("configure")}
          onVerified={(t) => {
            onToken(t);
            void createSubscription(t);
          }}
        />
      )}
    </div>
  );
}

function dedupeWindows(windows: StorefrontWindow[]): StorefrontWindow[] {
  const seen = new Map<string, StorefrontWindow>();
  for (const w of windows) {
    const key = `${w.label ?? ""}|${w.startTime}|${w.endTime}`;
    if (!seen.has(key)) seen.set(key, w);
  }
  return [...seen.values()];
}

function OrderSummary({
  currency,
  perDelivery,
  days,
}: {
  currency: string;
  perDelivery: number;
  days: number[];
}) {
  if (!perDelivery) return null;
  const perWeek = perDelivery * days.length;
  return (
    <div className="rounded-box border border-primary/25 bg-primary/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-base-content/65">Per delivery</span>
        <span className="font-semibold tabular-nums">{money(currency, perDelivery)}</span>
      </div>
      {days.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-primary/15 pt-2">
          <span className="text-base-content/65">Per week ({days.length}×)</span>
          <span className="text-base font-semibold tabular-nums text-primary">
            {money(currency, perWeek)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Auth (phone + OTP) ──────────────────────────────────────────────────── */

function AuthStep({
  handle,
  existingToken,
  busy,
  onBack,
  onVerified,
}: {
  handle: string;
  existingToken: string | null;
  busy: boolean;
  onBack: () => void;
  onVerified: (token: string) => void;
}) {
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already have a session token — skip straight through.
  useEffect(() => {
    if (existingToken) onVerified(existingToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      await storefrontApi.requestOtp(handle, phone.replace(/\s+/g, ""));
      setPhase("code");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    setSending(true);
    setError(null);
    try {
      const { token } = await storefrontApi.verifyOtp(handle, phone.replace(/\s+/g, ""), code.trim());
      onVerified(token);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackLink onClick={onBack}>Back</BackLink>
      <SectionLabel>{phase === "phone" ? "Your WhatsApp number" : "Enter the code"}</SectionLabel>
      {error && <Alert msg={error} />}

      {phase === "phone" ? (
        <>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Phone number with country code"
            className="input input-bordered w-full"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-base-content/50">
            We&apos;ll send a verification code to this number on WhatsApp.
          </p>
          <button
            className="btn btn-primary btn-block"
            disabled={sending || phone.trim().length < 8}
            onClick={sendCode}
          >
            {sending && <span className="loading loading-spinner loading-xs" />}
            Send code
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            className="input input-bordered w-full text-center text-lg tracking-[0.5em]"
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="btn btn-primary btn-block"
            disabled={sending || busy || code.trim().length < 4}
            onClick={verify}
          >
            {(sending || busy) && <span className="loading loading-spinner loading-xs" />}
            Verify &amp; subscribe
          </button>
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => setPhase("phone")}>
            Change number
          </button>
        </>
      )}
    </div>
  );
}

/* ── Manage existing subscriptions ───────────────────────────────────────── */

function ManageView({
  handle,
  catalog,
  token,
  onToken,
  onGoSubscribe,
}: {
  handle: string;
  catalog: StorefrontCatalog;
  token: string | null;
  onToken: (t: string | null) => void;
  onGoSubscribe: () => void;
}) {
  const [me, setMe] = useState<CustomerMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(!token);

  const load = useCallback(
    async (t: string) => {
      setLoading(true);
      setError(null);
      try {
        setMe(await storefrontApi.me(handle, t));
        setNeedsAuth(false);
      } catch (e) {
        if (e instanceof StorefrontError && (e.status === 401 || e.status === 403)) {
          onToken(null);
          setNeedsAuth(true);
        } else {
          setError(errMsg(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [handle, onToken],
  );

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  async function act(fn: () => Promise<unknown>) {
    if (!token) return;
    setError(null);
    try {
      await fn();
      await load(token);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  if (needsAuth || !token) {
    return (
      <AuthStep
        handle={handle}
        existingToken={null}
        busy={false}
        demoMode={catalog.demoMode}
        onBack={onGoSubscribe}
        onVerified={(t) => {
          onToken(t);
          void load(t);
        }}
      />
    );
  }

  if (loading && !me) return <CatalogSkeleton />;

  return (
    <div className="space-y-4">
      {error && <Alert msg={error} />}
      {me && (
        <div className="flex items-center gap-3 rounded-box border border-base-300 bg-base-200 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="op-label">Wallet balance</div>
            <div className="text-2xl font-semibold tabular-nums">
              {money(catalog.currency, me.wallet.balance)}
            </div>
          </div>
        </div>
      )}

      {me?.subscriptions.length === 0 && (
        <div className="space-y-3 rounded-2xl border border-dashed border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/60">You have no subscriptions yet.</p>
          <button className="btn btn-primary btn-sm" onClick={onGoSubscribe}>
            Start a subscription
          </button>
        </div>
      )}

      {me?.subscriptions.map((s) => (
        <div key={s.id} className="space-y-3 rounded-2xl border border-base-300 bg-base-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">{s.product?.name ?? s.plan.name}</div>
              <div className="text-xs text-base-content/50">{s.plan.name}</div>
            </div>
            <span
              className={`badge badge-sm ${
                s.status === "ACTIVE"
                  ? "badge-success"
                  : s.status === "PAUSED"
                    ? "badge-warning"
                    : "badge-ghost"
              }`}
            >
              {s.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {(s.cadence === "DAILY" ? [0, 1, 2, 3, 4, 5, 6] : s.daysOfWeek).map((d) => (
              <span
                key={d}
                className="rounded border border-base-300 bg-base-100 px-1.5 py-0.5 font-medium"
              >
                {WEEKDAY_LABELS[d]}
              </span>
            ))}
            {s.deliveryWindow && (
              <span className="ml-1 inline-flex items-center gap-1 text-base-content/50">
                <Clock className="h-3 w-3" />
                {s.deliveryWindow.startTime}–{s.deliveryWindow.endTime}
              </span>
            )}
          </div>

          {s.status !== "CANCELLED" && (
            <div className="flex flex-wrap gap-2 border-t border-base-300 pt-3">
              <SkipControl handle={handle} token={token} id={s.id} onDone={() => load(token)} />
              {s.status === "ACTIVE" ? (
                <button
                  className="btn btn-sm"
                  onClick={() => act(() => storefrontApi.pause(handle, token, s.id))}
                >
                  Pause
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => act(() => storefrontApi.resume(handle, token, s.id))}
                >
                  Resume
                </button>
              )}
              <button
                className="btn btn-sm btn-ghost text-error"
                onClick={() => {
                  if (confirm("Cancel this subscription?"))
                    void act(() => storefrontApi.cancel(handle, token, s.id));
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-ghost btn-block btn-sm" onClick={onGoSubscribe}>
        <Plus className="h-4 w-4" />
        New subscription
      </button>
    </div>
  );
}

function SkipControl({
  handle,
  token,
  id,
  onDone,
}: {
  handle: string;
  token: string;
  id: string;
  onDone: () => void;
}) {
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Skip a day
      </button>
    );
  return (
    <span className="flex items-center gap-1">
      <input
        type="date"
        className="input input-sm input-bordered"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button
        className="btn btn-sm btn-primary"
        disabled={!date || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await storefrontApi.skip(handle, token, id, date);
            setOpen(false);
            setDate("");
            onDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Check className="h-4 w-4" />
        Skip
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
        ✕
      </button>
    </span>
  );
}

/* ── Small shared bits ───────────────────────────────────────────────────── */

function PlanCard({
  plan,
  currency,
  selected,
  onSelect,
}: {
  plan: StorefrontPlan;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const from = plan.products.length
    ? Math.min(...plan.products.map((p) => Number(p.price)))
    : 0;
  return (
    <button
      onClick={onSelect}
      className={`op-grain relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-base-300 bg-base-200 hover:border-base-content/25"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold">{plan.name}</span>
        {from > 0 && (
          <span className="shrink-0 text-right">
            <span className="block text-[0.625rem] uppercase tracking-wide text-base-content/45">
              from
            </span>
            <span className="text-base font-semibold tabular-nums text-primary">
              {money(currency, from)}
            </span>
          </span>
        )}
      </div>
      {plan.description && (
        <p className="mt-1.5 text-sm text-base-content/60">{plan.description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {plan.products.slice(0, 4).map((p) => (
          <span
            key={p.productId}
            className="rounded-full border border-base-300 bg-base-100 px-2.5 py-0.5 text-xs"
          >
            {p.name}
          </span>
        ))}
        {plan.products.length > 4 && (
          <span className="rounded-full border border-base-300 bg-base-100 px-2.5 py-0.5 text-xs text-base-content/50">
            +{plan.products.length - 4} more
          </span>
        )}
      </div>
    </button>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["plan", "configure", "auth"];
  const labels: Record<string, string> = { plan: "Plan", configure: "Details", auth: "Confirm" };
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-2">
      {order.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col gap-1.5">
          <div
            className={`h-1.5 rounded-full transition-colors ${
              i <= idx ? "bg-primary" : "bg-base-300"
            }`}
          />
          <span
            className={`text-[0.625rem] font-medium uppercase tracking-wide ${
              i <= idx ? "text-primary" : "text-base-content/40"
            }`}
          >
            {labels[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="inline-flex items-center gap-1 text-sm text-base-content/60 transition-colors hover:text-base-content"
      onClick={onClick}
    >
      <ChevronLeft className="h-4 w-4" />
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="op-label">{children}</div>;
}

function Alert({ msg }: { msg: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5 text-sm text-error"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
