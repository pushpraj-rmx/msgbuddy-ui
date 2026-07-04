"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Info, Link2, Plug, RefreshCw } from "lucide-react";
import {
  useCommerceCredential,
  useConnectCredential,
  useDisconnectCredential,
  useCatalogs,
  useRefreshCatalogs,
  useConnectCatalog,
  useSyncCatalog,
} from "@/hooks/use-commerce";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getApiError } from "@/lib/api-error";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import type { ProductCatalog, ProductCatalogSyncStatus } from "@/lib/types";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CREDENTIAL_BADGE: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: "Connected", cls: "op-tag-ok" },
  PENDING: { label: "Pending", cls: "op-tag-warn" },
  ERROR: { label: "Error", cls: "op-tag-danger" },
  DISCONNECTED: { label: "Disconnected", cls: "" },
};

const SYNC_BADGE: Record<ProductCatalogSyncStatus, { label: string; cls: string }> = {
  NEVER_SYNCED: { label: "Never synced", cls: "" },
  SYNCING: { label: "Syncing", cls: "op-tag-warn" },
  SYNCED: { label: "Synced", cls: "op-tag-ok" },
  ERROR: { label: "Sync error", cls: "op-tag-danger" },
};

function CatalogRow({
  catalog,
  canManage,
}: {
  catalog: ProductCatalog;
  canManage: boolean;
}) {
  const connectCatalog = useConnectCatalog();
  const syncCatalog = useSyncCatalog();
  const [error, setError] = useState<string | null>(null);
  const sync = SYNC_BADGE[catalog.syncStatus] ?? SYNC_BADGE.NEVER_SYNCED;

  return (
    <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{catalog.name}</span>
            {catalog.connectedToWaba ? (
              <span className="op-tag op-tag-ok">On WhatsApp</span>
            ) : (
              <span className="op-tag">Not connected</span>
            )}
            <span className={`op-tag ${sync.cls}`}>{sync.label}</span>
          </div>
          <p className="mt-1 font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
            {catalog.productCount} products
            {catalog.feedCount > 0 ? ` · ${catalog.feedCount} feeds` : ""}
            {catalog.lastSyncedAt
              ? ` · synced ${formatDate(catalog.lastSyncedAt)}`
              : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1.5">
            {!catalog.connectedToWaba && (
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => {
                  setError(null);
                  connectCatalog.mutate(catalog.id, {
                    onError: (e) => setError(getApiError(e)),
                  });
                }}
                disabled={connectCatalog.isPending}
              >
                {connectCatalog.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Connect to WhatsApp
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => {
                setError(null);
                syncCatalog.mutate(catalog.id, {
                  onError: (e) => setError(getApiError(e)),
                });
              }}
              disabled={syncCatalog.isPending}
            >
              {syncCatalog.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync products
            </button>
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-[0.8125rem] text-base-content"
        >
          {error}
        </div>
      )}
    </div>
  );
}

export function CommerceSettingsClient({ meRole }: { meRole: string }) {
  const canManage = roleHasWorkspacePermission(meRole, "commerce.manage");

  const credentialQuery = useCommerceCredential();
  const credential = credentialQuery.data;
  const connected = credential?.connected ?? false;

  const catalogsQuery = useCatalogs({ enabled: connected });
  const catalogs = catalogsQuery.data ?? [];

  const connectCredential = useConnectCredential();
  const disconnectCredential = useDisconnectCredential();
  const refreshCatalogs = useRefreshCatalogs();

  const [accessToken, setAccessToken] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleConnect = () => {
    setFormError(null);
    setFormSuccess(null);
    if (!accessToken.trim()) {
      setFormError("Paste a System User access token to continue.");
      return;
    }
    connectCredential.mutate(
      {
        accessToken: accessToken.trim(),
        businessId: businessId.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAccessToken("");
          setBusinessId("");
          setFormSuccess("Catalog access connected.");
        },
        onError: (e) => setFormError(getApiError(e)),
      }
    );
  };

  const infoBox = (
    <div className="rounded-box border border-info/30 border-l-2 border-l-info bg-base-200 px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-info" />
        <span className="op-label text-info">catalog access</span>
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-base-content/70">
        Product catalogs live on your Meta Business, not on your WhatsApp number —
        the WhatsApp token alone can&apos;t read them. Create a{" "}
        <strong>System User token</strong> with the{" "}
        <code className="font-mono-op">catalog_management</code> permission, assign
        the catalog to that System User with the <strong>MANAGE</strong> task, then
        paste the token here so we can mirror your catalogs and products.
      </p>
    </div>
  );

  if (credentialQuery.isLoading) {
    return <LoadingState label="Loading commerce settings…" />;
  }

  if (credentialQuery.error) {
    return (
      <ErrorState
        message={getApiError(credentialQuery.error)}
        suggestion="Try refreshing the page."
      />
    );
  }

  return (
    <div className="space-y-4">
      {infoBox}

      {!connected ? (
        <div className="space-y-4">
          {credential?.status === "ERROR" && credential.lastError && (
            <div
              role="alert"
              className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3 text-[0.8125rem] text-base-content"
            >
              Last connection attempt failed: {credential.lastError}
            </div>
          )}

          {canManage ? (
            <div className="rounded-box border border-base-300 bg-base-200 px-4 py-4">
              <h2 className="text-sm font-semibold text-base-content">
                Connect catalog access
              </h2>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="op-label mb-1.5 block">
                    System User access token
                  </label>
                  <textarea
                    className="textarea textarea-bordered min-h-24 w-full font-mono-op text-[0.8125rem]"
                    placeholder="EAAB…"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>
                <div>
                  <label className="op-label mb-1.5 block">
                    Business ID <span className="text-base-content/40">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full max-w-xs font-mono-op"
                    placeholder="1234567890"
                    value={businessId}
                    onChange={(e) => setBusinessId(e.target.value)}
                  />
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-100 px-3 py-2 text-[0.8125rem] text-base-content"
                  >
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div
                    role="alert"
                    className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-100 px-3 py-2 text-[0.8125rem] text-base-content"
                  >
                    {formSuccess}
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-1"
                    onClick={handleConnect}
                    disabled={connectCredential.isPending}
                  >
                    {connectCredential.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Plug className="h-3.5 w-3.5" />
                    )}
                    Connect catalog access
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="rounded-box border border-base-300 bg-base-200 px-4 py-3 text-[0.8125rem] text-base-content/70"
            >
              Catalog access isn&apos;t connected yet. Ask a workspace owner or admin
              to connect it.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection status */}
          <div className="rounded-box border border-base-300 bg-base-200 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-base-content">
                    Catalog access
                  </span>
                  <span
                    className={`op-tag ${
                      (CREDENTIAL_BADGE[credential?.status ?? ""] ?? CREDENTIAL_BADGE.DISCONNECTED).cls
                    }`}
                  >
                    {(CREDENTIAL_BADGE[credential?.status ?? ""] ?? CREDENTIAL_BADGE.DISCONNECTED).label}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono-op text-[0.6875rem] tabular-nums text-base-content/60">
                  <dt className="text-base-content/45">Business ID</dt>
                  <dd>{credential?.businessId ?? "—"}</dd>
                  <dt className="text-base-content/45">Last verified</dt>
                  <dd>{formatDate(credential?.lastVerifiedAt)}</dd>
                </dl>
                {credential?.lastError && (
                  <p className="mt-2 text-[0.75rem] text-error">
                    {credential.lastError}
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error/70 hover:text-error"
                  onClick={() => setDisconnectOpen(true)}
                  disabled={disconnectCredential.isPending}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Catalogs */}
          <div className="rounded-box border border-base-300 bg-base-200 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-base-content/45" />
                <h2 className="text-sm font-semibold text-base-content">Catalogs</h2>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  onClick={() => {
                    setRefreshError(null);
                    refreshCatalogs.mutate(undefined, {
                      onError: (e) => setRefreshError(getApiError(e)),
                    });
                  }}
                  disabled={refreshCatalogs.isPending}
                >
                  {refreshCatalogs.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Refresh from Meta
                </button>
              )}
            </div>

            {refreshError && (
              <div
                role="alert"
                className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-100 px-3 py-2 text-[0.8125rem] text-base-content"
              >
                {refreshError}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {catalogsQuery.isLoading ? (
                <LoadingState label="Loading catalogs…" />
              ) : catalogsQuery.error ? (
                <ErrorState message={getApiError(catalogsQuery.error)} />
              ) : catalogs.length === 0 ? (
                <p className="rounded-box border border-dashed border-base-300 bg-base-100 px-4 py-6 text-center text-[0.8125rem] text-base-content/55">
                  No catalogs found yet.{" "}
                  {canManage
                    ? "Use “Refresh from Meta” to pull them in."
                    : "Ask an admin to refresh from Meta."}
                </p>
              ) : (
                catalogs.map((catalog) => (
                  <CatalogRow
                    key={catalog.id}
                    catalog={catalog}
                    canManage={canManage}
                  />
                ))
              )}
            </div>

            <p className="mt-3 text-[0.75rem] text-base-content/45">
              Browse mirrored products on the{" "}
              <Link href="/commerce/products" className="link link-hover text-primary">
                Products
              </Link>{" "}
              page.
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={disconnectOpen}
        title="Disconnect catalog access"
        description="This removes the stored System User token. Mirrored catalogs and products stay, but they will no longer sync until you reconnect."
        confirmLabel="Disconnect"
        tone="danger"
        loading={disconnectCredential.isPending}
        onConfirm={() =>
          disconnectCredential.mutate(undefined, {
            onSuccess: () => setDisconnectOpen(false),
          })
        }
        onClose={() => setDisconnectOpen(false)}
      />
    </div>
  );
}
