"use client";

import { useState } from "react";
import {
  useClientWabas,
  useSharingInfo,
  useRecheckOnboarding,
} from "@/hooks/use-onboarding";
import { useConnectedClientBusinesses } from "@/hooks/use-platform";
import { getApiError } from "@/lib/api-error";
import type { ConnectedClientBusiness } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/ui/states";

function isMetaTokenMissingError(err: unknown): boolean {
  const message = getApiError(err);
  return message.includes("META_SYSTEM_ACCESS_TOKEN is not configured");
}

export function OnboardingWabaClient() {
  const client = useClientWabas();
  const businesses = useConnectedClientBusinesses();
  const sharing = useSharingInfo();
  const recheck = useRecheckOnboarding();

  const tokenMissing =
    isMetaTokenMissingError(client.error) ||
    isMetaTokenMissingError(businesses.error);

  if (tokenMissing) {
    return (
      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <span className="op-label mb-1 block text-error">token missing</span>
        <p className="text-[0.8125rem] text-base-content">
          META_SYSTEM_ACCESS_TOKEN is not configured. Ask an administrator to configure
          Meta system token before using onboarding discovery.
        </p>
      </div>
    );
  }

  const wabas = client.data?.wabas ?? [];
  const wabaBusinessIds = new Set(
    wabas.map((w) => w.businessId).filter(Boolean),
  );
  // Businesses that connected via Embedded Signup but whose WABA we can't see —
  // the customer needs to share / partner-assign it to us.
  const unmatchedBusinesses = (businesses.data ?? []).filter(
    (b) => !wabaBusinessIds.has(b.id),
  );

  return (
    <div className="space-y-4">
      {client.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[0.8125rem] text-base-content">{getApiError(client.error)}</p></div>
      )}

      <ShareWabaGuidance
        partnerBusinessId={sharing.data?.partnerBusinessId ?? null}
        unmatchedBusinesses={unmatchedBusinesses}
        onRecheck={recheck}
        rechecking={client.isFetching || businesses.isFetching}
      />

      <WabaSection
        title="Connected client WABAs"
        description="WhatsApp Business Accounts from onboarded client accounts, hydrated live from Meta."
        loading={client.isLoading}
        count={client.data?.count ?? 0}
        wabas={client.data?.wabas ?? []}
      />

      <ConnectedBusinessesSection
        loading={businesses.isLoading}
        error={businesses.error}
        businesses={businesses.data ?? []}
      />
    </div>
  );
}

function ShareWabaGuidance({
  partnerBusinessId,
  unmatchedBusinesses,
  onRecheck,
  rechecking,
}: {
  partnerBusinessId: string | null;
  unmatchedBusinesses: ConnectedClientBusiness[];
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const hasGap = unmatchedBusinesses.length > 0;

  const copyId = async () => {
    if (!partnerBusinessId) return;
    try {
      await navigator.clipboard.writeText(partnerBusinessId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the id is still shown for manual copy.
    }
  };

  return (
    <div
      className={`rounded-box border bg-base-200 ${
        hasGap
          ? "border-warning/40 border-l-2 border-l-warning"
          : "border-base-300"
      }`}
    >
      <div className="border-b border-base-300 px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">
              WABA not showing up? Share it with us
            </h2>
            <span className="op-label">
              A WABA only appears once the customer shares it with our business.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onRecheck}
            disabled={rechecking}
          >
            {rechecking ? "Re-checking…" : "Re-check"}
          </button>
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {hasGap && (
          <div
            role="alert"
            className="rounded-box border border-warning/30 bg-base-100 px-3 py-2 text-[0.78125rem]"
          >
            <span className="op-label mb-1 block text-warning">
              {unmatchedBusinesses.length} connected{" "}
              {unmatchedBusinesses.length === 1 ? "business" : "businesses"}{" "}
              without a shared WABA
            </span>
            <ul className="space-y-0.5">
              {unmatchedBusinesses.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="font-mono-op text-[0.625rem] text-base-content/55">
                    {b.id}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="list-decimal space-y-1.5 pl-5 text-[0.8125rem] text-base-content">
          <li>
            In <span className="font-medium">Meta Business Manager</span>, open{" "}
            <span className="font-medium">
              Business settings → Accounts → WhatsApp accounts
            </span>{" "}
            and select the WABA.
          </li>
          <li>
            Click <span className="font-medium">Add partner</span> and enter our
            partner business ID:{" "}
            {partnerBusinessId ? (
              <button
                type="button"
                onClick={copyId}
                className="op-tag font-mono-op cursor-pointer"
                title="Copy to clipboard"
              >
                {partnerBusinessId}
                {copied ? " ✓" : ""}
              </button>
            ) : (
              <span className="text-warning">
                not configured (set META_BUSINESS_ID)
              </span>
            )}
          </li>
          <li>
            Grant the <span className="font-medium">Manage</span> permission on
            the account, then save.
          </li>
          <li>
            Return here and click <span className="font-medium">Re-check</span> —
            the WABA should now appear below.
          </li>
        </ol>
      </div>
    </div>
  );
}

function ConnectedBusinessesSection({
  loading,
  error,
  businesses,
}: {
  loading: boolean;
  error: unknown;
  businesses: ConnectedClientBusiness[];
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="border-b border-base-300 px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Connected client businesses</h2>
            <span className="op-label">Businesses connected to the app via Embedded Signup. One without a WABA above hasn&apos;t finished onboarding.</span>
          </div>
          <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
            count · {businesses.length}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {!!error && (
          <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-100 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[0.8125rem] text-base-content">{getApiError(error)}</p></div>
        )}
        {loading && <LoadingState label="Loading businesses…" />}
        {!loading && !error && !businesses.length && (
          <EmptyState title="No connected businesses" description="No client businesses are connected to the app." />
        )}
        {!!businesses.length && (
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="w-full text-[0.78125rem]">
              <thead>
                <tr className="border-b border-base-300 bg-base-200">
                  <th className="op-label px-3 py-2.5 text-left font-medium">ID</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Name</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Verification</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Business status</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business.id} className="border-b border-base-300 last:border-b-0">
                    <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[0.625rem] tracking-wider text-base-content/60">{business.id}</td>
                    <td className="px-3 py-3 font-medium">{business.name}</td>
                    <td className="px-3 py-3"><span className="op-tag">{business.verification_status || "—"}</span></td>
                    <td className="px-3 py-3"><span className="op-tag">{business.business_status || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WabaSection({
  title,
  description,
  loading,
  count,
  wabas,
}: {
  title: string;
  description: string;
  loading: boolean;
  count: number;
  wabas: Array<{
    id: string;
    name: string;
    businessName?: string;
    accountReviewStatus?: string;
    isClientShared?: boolean;
    permissions?: string[];
    phoneNumbers: Array<{
      id: string;
      displayPhoneNumber: string;
      verifiedName: string;
      quality: string;
      status: string;
    }>;
  }>;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="border-b border-base-300 px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">{title}</h2>
            <span className="op-label">{description}</span>
          </div>
          <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
            count · {count}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {loading && <LoadingState label="Loading WABAs…" />}
        {!loading && !wabas.length && (
          <EmptyState title="No WABAs found" description="Nothing matched the current search parameters." />
        )}
        {!!wabas.length && (
          <div className="grid gap-3 lg:grid-cols-2">
            {wabas.map((waba) => (
              <div key={waba.id} className="rounded-box border border-base-300 bg-base-100">
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{waba.name}</h3>
                    <span className="op-tag font-mono-op">{waba.id}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Business: {waba.businessName || "-"}</p>
                    <p>Review: {waba.accountReviewStatus || "-"}</p>
                    <p>Client shared: {waba.isClientShared ? "Yes" : "No"}</p>
                    <p>
                      Permissions:{" "}
                      {waba.permissions?.length ? waba.permissions.join(", ") : "-"}
                    </p>
                  </div>
                  <div className="my-2 border-t border-base-300" />
                  <div className="space-y-1">
                    <p className="op-label">Phone numbers</p>
                    {waba.phoneNumbers.length ? (
                      waba.phoneNumbers.map((phone) => (
                        <div
                          key={phone.id}
                          className="rounded-box border border-base-300 p-2 text-xs"
                        >
                          <p className="font-medium">{phone.displayPhoneNumber}</p>
                          <p>{phone.verifiedName}</p>
                          <p>
                            Quality: {phone.quality} | Status: {phone.status}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-base-content/60">
                        No phone numbers returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
