"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Rocket, Star, Crown, RefreshCw } from "lucide-react";
import { billingApi, type BillingCurrentResponse } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type PlanCardDef = {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const PLAN_CARDS: PlanCardDef[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "500 messages/mo",
      "100 contacts",
      "1 team member",
      "1 phone number",
      "256 MB storage",
    ],
    cta: "Current plan",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    features: [
      "10,000 messages/mo",
      "10,000 contacts",
      "5 team members",
      "2 phone numbers",
      "2 GB storage",
      "Campaign support",
    ],
    cta: "Upgrade to Starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$79",
    period: "/month",
    highlighted: true,
    features: [
      "50,000 messages/mo",
      "100,000 contacts",
      "15 team members",
      "5 phone numbers",
      "10 GB storage",
      "Campaign support",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Upgrade to Growth",
  },
  {
    id: "scale",
    name: "Scale",
    price: "Custom",
    period: "",
    features: [
      "Unlimited messages",
      "1,000,000+ contacts",
      "50+ team members",
      "20+ phone numbers",
      "50 GB+ storage",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact sales",
  },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function planDisplayName(plan: string): string {
  const names: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    growth: "Growth",
    scale: "Scale",
  };
  return names[plan] ?? plan;
}

type SubscriptionDetail = {
  id: string;
  status: string;
  planId: string;
  currentStart: string | null;
  currentEnd: string | null;
  chargeAt: string;
  paidCount: number;
  shortUrl: string;
} | null;

export function BillingClient({ workspaceId }: { workspaceId: string }) {
  const [billing, setBilling] = useState<BillingCurrentResponse | null>(null);
  const [subscriptionDetail, setSubscriptionDetail] = useState<SubscriptionDetail>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      billingApi.current(workspaceId),
      billingApi.subscription().catch(() => ({ subscription: null, configured: false })),
    ])
      .then(([b, sub]) => {
        setBilling(b);
        setSubscriptionDetail(sub.subscription ?? null);
      })
      .catch((err) =>
        setError(err?.response?.data?.message ?? "Failed to load billing data"),
      )
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-lg loading-spinner text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <span>{error}</span>
      </div>
    );
  }

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    setError("");
    try {
      const result = await billingApi.subscribe(planId);
      // Redirect to Razorpay checkout (replace so back-button doesn't land on stale checkout page)
      window.location.replace(result.shortUrl);
    } catch (err) {
      setError(getApiError(err) || "Failed to create subscription");
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await billingApi.cancel();
      const updated = await billingApi.current(workspaceId);
      setBilling(updated);
      setShowCancelConfirm(false);
    } catch (err) {
      setError(getApiError(err) || "Failed to cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSyncLimits = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    setError("");
    try {
      await billingApi.syncPlanLimits();
      const updated = await billingApi.current(workspaceId);
      setBilling(updated);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err) {
      setError(getApiError(err) || "Failed to sync plan limits");
    } finally {
      setSyncing(false);
    }
  };

  if (!billing) return null;

  const isTrial = billing.plan === "growth" && billing.planExpiresAt;
  const trialDays = daysUntil(billing.planExpiresAt);

  return (
    <div className="space-y-6">
      {/* Current plan overview */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Current plan</h2>

        <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {planDisplayName(billing.plan)}
                </span>
                {isTrial ? (
                  <span className="op-tag op-tag-warn">Trial</span>
                ) : null}
              </div>
              {isTrial && trialDays !== null ? (
                <p className="text-sm text-base-content/60">
                  {trialDays === 0
                    ? "Trial expires today"
                    : `${trialDays} day${trialDays !== 1 ? "s" : ""} remaining in trial`}
                </p>
              ) : null}
              {!isTrial && billing.plan !== "free" ? (
                <p className="text-sm text-base-content/60">
                  Billing period: {formatDate(billing.billingCycleStart)} &ndash;{" "}
                  {formatDate(billing.billingCycleEnd)}
                </p>
              ) : null}
            </div>
            {billing.plan === "free" || isTrial ? (
              <Link href="#plans" className="btn btn-primary btn-sm">
                Upgrade plan
              </Link>
            ) : billing.plan !== "scale" && billing.subscriptionId ? (
              <button
                className="btn btn-sm border-error/40 text-error hover:bg-error/10"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel subscription
              </button>
            ) : null}
          </div>

          {/* Limits summary */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <LimitCard
              label="Messages"
              current={billing.usage?.messagesSent ?? 0}
              limit={billing.limits.maxMessages}
            />
            <LimitCard
              label="Contacts"
              current={billing.usage?.contactsCreated ?? 0}
              limit={billing.limits.maxContacts}
            />
            <LimitCard
              label="Team"
              current={null}
              limit={billing.limits.maxAgents}
            />
            <LimitCard
              label="Numbers"
              current={null}
              limit={billing.limits.maxNumbers}
            />
            <LimitCard
              label="Storage"
              current={null}
              limit={billing.limits.maxStorageBytes}
              formatValue={(v) => formatBytes(v)}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn btn-sm btn-ghost gap-2"
              disabled={syncing || billing.plan === "scale"}
              onClick={handleSyncLimits}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync plan limits
            </button>
            {syncSuccess ? (
              <span className="text-sm text-success">Limits synced</span>
            ) : null}
            {billing.plan === "scale" ? (
              <span className="text-xs text-base-content/50">
                Scale plan limits are managed manually
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section id="plans" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Available plans
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_CARDS.map((plan) => {
            const isCurrent = billing.plan === plan.id;
            const isTrialPlan = isTrial && plan.id === "growth";
            return (
              <div
                key={plan.id}
                className={`rounded-box border bg-base-200 p-5 ${
                  isCurrent
                    ? "border-primary border-l-2 border-l-primary"
                    : plan.highlighted
                      ? "border-primary"
                      : "border-base-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {plan.id === "starter" ? (
                    <Rocket className="h-5 w-5 text-primary" />
                  ) : plan.id === "growth" ? (
                    <Star className="h-5 w-5 text-warning" />
                  ) : plan.id === "scale" ? (
                    <Crown className="h-5 w-5 text-secondary" />
                  ) : null}
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                </div>
                <p className="mt-2">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  {plan.period ? (
                    <span className="text-sm text-base-content/50">
                      {plan.period}
                    </span>
                  ) : null}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-base-content/80"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent && !isTrialPlan ? (
                    <button className="btn btn-sm w-full" disabled>
                      Current plan
                    </button>
                  ) : plan.id === "scale" ? (
                    <a
                      href="mailto:sales@msgbuddy.com"
                      className="btn btn-sm w-full"
                    >
                      Contact sales
                    </a>
                  ) : plan.id === "free" && billing.plan === "free" ? (
                    <button className="btn btn-sm w-full" disabled>
                      Current plan
                    </button>
                  ) : (
                    <button
                      className={`btn btn-sm w-full ${
                        plan.highlighted ? "btn-primary" : ""
                      }`}
                      disabled={subscribing === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {subscribing === plan.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : isTrialPlan ? (
                        "Subscribe to keep Growth"
                      ) : (
                        plan.cta
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Billing details */}
      {billing.billingEmail || billing.subscriptionId ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Billing details
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {billing.billingEmail ? (
              <InfoCard label="Billing email" value={billing.billingEmail} />
            ) : null}
            {billing.subscriptionId ? (
              <InfoCard
                label="Subscription ID"
                value={billing.subscriptionId}
              />
            ) : null}
            {billing.planExpiresAt ? (
              <InfoCard
                label={isTrial ? "Trial ends" : "Plan expires"}
                value={formatDate(billing.planExpiresAt)}
              />
            ) : null}
            {subscriptionDetail ? (
              <>
                <InfoCard label="Status" value={subscriptionDetail.status} />
                {subscriptionDetail.currentStart ? (
                  <InfoCard label="Period start" value={formatDate(subscriptionDetail.currentStart)} />
                ) : null}
                {subscriptionDetail.currentEnd ? (
                  <InfoCard label="Period end" value={formatDate(subscriptionDetail.currentEnd)} />
                ) : null}
                <InfoCard label="Next charge" value={formatDate(subscriptionDetail.chargeAt)} />
                <InfoCard label="Payments made" value={String(subscriptionDetail.paidCount)} />
              </>
            ) : null}
          </div>
        </section>
      ) : null}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel subscription"
        description="You will be downgraded to the Free plan at the end of your current billing period. All Growth features will become unavailable."
        confirmLabel="Cancel subscription"
        tone="danger"
        loading={cancelLoading}
        onConfirm={handleCancel}
        onClose={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}

function LimitCard({
  label,
  current,
  limit,
  formatValue,
}: {
  label: string;
  current: number | null;
  limit: number;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  const pct =
    current !== null ? Math.min(100, Math.round((current / limit) * 100)) : null;

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/30 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-base-content">
        {current !== null ? (
          <>
            {fmt(current)}{" "}
            <span className="text-base-content/50">/ {fmt(limit)}</span>
          </>
        ) : (
          fmt(limit)
        )}
      </div>
      {pct !== null ? (
        <progress
          className={`progress mt-1.5 h-1.5 w-full ${
            pct >= 100
              ? "progress-error"
              : pct >= 90
                ? "progress-warning"
                : "progress-primary"
          }`}
          value={pct}
          max="100"
        />
      ) : null}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-200/30 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-base-content">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
