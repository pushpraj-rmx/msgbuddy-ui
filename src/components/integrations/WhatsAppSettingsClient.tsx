"use client";

import Link from "next/link";
import { useState } from "react";
import { WhatsAppIntegrationPage } from "@/components/integrations/WhatsAppIntegrationPage";
import { WhatsAppOnboardingPanel } from "@/components/integrations/WhatsAppOnboardingPanel";
import {
  workspaceApi,
  whatsappApi,
  usageApi,
  type WhatsAppConnection,
  type WhatsAppPhoneStatus,
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceSettingsPayload,
  type WorkspaceCloudApiConfigPayload,
} from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/axios";
import { EmptyState } from "@/components/ui/states";
import { InfoTip } from "@/components/ui/InfoTip";

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

type StatusErrorBody = { statusCode?: number; message?: string };

/* ── Connection card per phone number ─────────────────────────── */

function ConnectionRow({
  connection,
  onDisconnect,
  disconnecting,
}: {
  connection: WhatsAppConnection;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const phoneStatusQuery = useQuery({
    queryKey: ["whatsapp", "phone-status", connection.phoneNumberId],
    queryFn: () => whatsappApi.fetchPhoneStatus(connection.phoneNumberId),
    enabled: Boolean(connection.phoneNumberId?.trim()),
    staleTime: 30_000,
    retry: 1,
  });

  const queryError = phoneStatusQuery.error as ApiError | null;
  const errorStatus = queryError?.status;
  const errorMessage =
    (queryError?.data as StatusErrorBody | undefined)?.message ||
    queryError?.message ||
    "Failed to load phone number status.";

  const statusData: WhatsAppPhoneStatus | undefined = phoneStatusQuery.data;
  const displayPhone =
    statusData?.displayPhoneNumber || connection.phoneNumberId || "Unknown";

  const statusTag = connection.status === "ACTIVE"
    ? "op-tag op-tag-ok"
    : connection.status === "EXPIRED"
      ? "op-tag op-tag-warn"
      : connection.status === "ERROR"
        ? "op-tag op-tag-danger"
        : "op-tag";

  return (
    <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tabular-nums tracking-tight truncate">
              {displayPhone}
            </span>
            {connection.isDefault && <span className="op-tag op-tag-ok">Default</span>}
            {connection.status && <span className={statusTag}>{connection.status}</span>}
          </div>
          <div className="font-mono-op text-[10px] tracking-[0.04em] text-base-content/45 truncate">
            {connection.phoneNumberId}
            {connection.wabaId ? ` · ${connection.wabaId}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => phoneStatusQuery.refetch()}
            disabled={!phoneStatusQuery.isFetched || phoneStatusQuery.isFetching}
          >
            {phoneStatusQuery.isFetching ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Refresh"
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error/70 hover:text-error"
            onClick={onDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Disconnect"
            )}
          </button>
        </div>
      </div>

      {/* ── Status fields ── */}
      {phoneStatusQuery.isLoading ? (
        <div className="flex gap-2">
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-5 w-16" />
        </div>
      ) : errorStatus === 404 ? (
        <p className="text-[12px] text-base-content/50">
          Not found — number may not be connected yet.
        </p>
      ) : errorStatus === 422 ? (
        <p className="text-[12px] text-warning">{errorMessage}</p>
      ) : phoneStatusQuery.isError ? (
        <p className="text-[12px] text-error/70">{errorMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {statusData?.verifiedName && (
            <span className="op-tag">{statusData.verifiedName}</span>
          )}
          {statusData?.qualityRating && (
            <span
              className={
                statusData.qualityRating === "GREEN"
                  ? "op-tag op-tag-ok"
                  : statusData.qualityRating === "RED"
                    ? "op-tag op-tag-danger"
                    : statusData.qualityRating === "YELLOW"
                      ? "op-tag op-tag-warn"
                      : "op-tag"
              }
            >
              {statusData.qualityRating}
            </span>
          )}
          {statusData?.verificationStatus && (
            <span className="op-tag">{statusData.verificationStatus}</span>
          )}
          {statusData?.status && (
            <span className="op-tag">{statusData.status}</span>
          )}
        </div>
      )}

      {/* ── Onboarding (collapsible) ── */}
      <details className="group">
        <summary className="op-label cursor-pointer select-none group-open:mb-2">
          ▸ Number onboarding
        </summary>
        <WhatsAppOnboardingPanel
          phoneNumberId={connection.phoneNumberId}
          registrationPending={connection.registrationPending}
          metaPhoneStatus={connection.metaPhoneStatus ?? undefined}
          metaVerificationStatus={connection.metaVerificationStatus ?? undefined}
        />
      </details>
    </div>
  );
}

/* ── Main settings page ───────────────────────────────────────── */

export function WhatsAppSettingsClient({
  workspaceId,
  cloudApiConfig,
}: {
  workspaceId: string;
  settings: WorkspaceSettings;
  cloudApiConfig: WorkspaceCloudApiConfigResponse | null;
}) {
  const queryClient = useQueryClient();

  const [cloudForm, setCloudForm] = useState({
    phoneNumberId: cloudApiConfig?.phoneNumberId ?? "",
    wabaId: cloudApiConfig?.wabaId ?? "",
    accessToken: "",
  });
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudApiConfigState, setCloudApiConfigState] =
    useState<WorkspaceCloudApiConfigResponse | null>(cloudApiConfig);

  const connectionsQuery = useQuery({
    queryKey: ["whatsapp", "connections"],
    queryFn: () => whatsappApi.listConnections(),
    staleTime: 30_000,
    retry: 1,
  });

  const limitsQuery = useQuery({
    queryKey: ["usage", "limits"],
    queryFn: () => usageApi.limits(),
    staleTime: 60_000,
    retry: 1,
  });

  const maxNumbers: number = (limitsQuery.data as { limits?: { maxNumbers?: number } } | undefined)?.limits?.maxNumbers ?? Infinity;
  const connectedCount = connectionsQuery.data?.length ?? 0;
  const atLimit = connectedCount >= maxNumbers;

  const disconnectMutation = useMutation({
    mutationFn: (cloudApiAccountId: string) => whatsappApi.disconnect(cloudApiAccountId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connections"] });
    },
  });

  const handleCloudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloudError(null);
    setCloudSaving(true);
    try {
      const payload: WorkspaceCloudApiConfigPayload = {
        phoneNumberId: cloudForm.phoneNumberId,
        wabaId: cloudForm.wabaId,
      };
      if (cloudForm.accessToken.trim()) {
        payload.accessToken = cloudForm.accessToken;
      }
      const updated = await workspaceApi.updateCloudApiConfig(workspaceId, payload);
      setCloudApiConfigState(updated);
      setCloudForm((prev) => ({ ...prev, accessToken: "" }));
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : "Failed to save Cloud API config");
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <span className="op-label">integration</span>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">WhatsApp</h1>
        <p className="mt-0.5 text-[13px] text-base-content/60">
          Connect and manage WhatsApp Business phone numbers for this workspace.
        </p>
      </div>

      {/* ── Templates shortcut ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200 px-4 py-3">
        <div className="min-w-0">
          <span className="op-label">templates</span>
          <p className="mt-0.5 text-[13px] text-base-content/70">
            Import existing WhatsApp templates from Meta into MsgBuddy.
          </p>
        </div>
        <Link
          className="btn btn-outline btn-sm"
          href="/settings/integrations/whatsapp/import-templates?returnTo=%2Fsettings%2Fintegrations%2Fwhatsapp"
        >
          Import from Meta
        </Link>
      </div>

      {/* ── Add number ── */}
      <div className="op-grain relative rounded-box border border-base-300 bg-base-200 p-4 sm:p-5">
        <span className="op-label">connect</span>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Add WhatsApp number</p>
            <p className="mt-0.5 text-[12px] text-base-content/55">
              Connect a phone number using Meta Embedded Signup.
            </p>
          </div>
          {maxNumbers !== Infinity && (
            <span className="op-tag font-mono-op tabular-nums">
              {connectedCount} / {maxNumbers} used
            </span>
          )}
        </div>
        <div className="mt-3">
          <WhatsAppIntegrationPage
            variant="connectOnly"
            initialCloudApiConfig={cloudApiConfigState}
            atLimit={atLimit}
            onConnected={async () => {
              await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connections"] });
            }}
          />
        </div>
      </div>

      {/* ── Connected numbers ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="op-section-title">Connected numbers</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => connectionsQuery.refetch()}
            disabled={connectionsQuery.isFetching}
          >
            {connectionsQuery.isFetching ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Refreshing…
              </>
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        {connectionsQuery.isLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-20 w-full rounded-box" />
            <div className="skeleton h-20 w-full rounded-box" />
          </div>
        ) : connectionsQuery.isError ? (
          <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[13px]">Failed to load WhatsApp connections.</p>
            <button
              type="button"
              className="btn btn-outline btn-xs mt-2"
              onClick={() => connectionsQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : !connectionsQuery.data?.length ? (
          <EmptyState
            title="No numbers connected"
            description="Use the connect flow above to link your first WhatsApp Business number."
          />
        ) : (
          <div className="space-y-3">
            {connectionsQuery.data.map((conn) => (
              <ConnectionRow
                key={conn.id}
                connection={conn}
                onDisconnect={() => disconnectMutation.mutate(conn.id)}
                disconnecting={disconnectMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Advanced: Cloud API config ── */}
      <details className="group rounded-box border border-base-300 bg-base-200">
        <summary className="cursor-pointer select-none px-4 py-3 sm:px-5">
          <span className="op-label">advanced</span>
          <p className="mt-0.5 text-[13px] font-semibold">Meta Cloud API</p>
          <p className="text-[12px] text-base-content/55">
            Manual token and ID configuration. Expand only if you know what you&apos;re doing.
          </p>
        </summary>

        <div className="border-t border-base-300 px-4 py-4 sm:px-5 space-y-4">
          {cloudApiConfigState && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  cloudApiConfigState.status === "ACTIVE"
                    ? "op-tag op-tag-ok"
                    : cloudApiConfigState.status === "EXPIRED"
                      ? "op-tag op-tag-warn"
                      : "op-tag"
                }
              >
                {cloudApiConfigState.status}
              </span>
              <span className="op-tag">
                Token: {cloudApiConfigState.hasAccessToken ? "Set" : "Not set"}
              </span>
              {cloudApiConfigState.tokenExpiresAt && (
                <span className="op-tag font-mono-op tabular-nums">
                  Expires {new Date(cloudApiConfigState.tokenExpiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleCloudSubmit} className="space-y-3 max-w-lg">
            <label className="form-control">
              <span className="op-label mb-1">Phone number ID</span>
              <input
                type="text"
                className="input input-bordered input-sm font-mono"
                value={cloudForm.phoneNumberId}
                onChange={(e) =>
                  setCloudForm((p) => ({ ...p, phoneNumberId: e.target.value }))
                }
                required
                placeholder="e.g. 123456789"
              />
            </label>
            <label className="form-control">
              <span className="op-label mb-1 flex items-center gap-1.5">
                WABA ID
                <InfoTip tip="WhatsApp Business Account ID — find it in Meta Business Manager → WhatsApp Accounts" />
              </span>
              <input
                type="text"
                className="input input-bordered input-sm font-mono"
                value={cloudForm.wabaId}
                onChange={(e) => setCloudForm((p) => ({ ...p, wabaId: e.target.value }))}
                required
                placeholder="WhatsApp Business Account ID"
              />
            </label>
            <label className="form-control">
              <span className="op-label mb-1">Access token</span>
              <input
                type="password"
                className="input input-bordered input-sm"
                value={cloudForm.accessToken}
                onChange={(e) =>
                  setCloudForm((p) => ({ ...p, accessToken: e.target.value }))
                }
                placeholder="Leave blank to keep existing"
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={cloudSaving}>
              {cloudSaving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Save"
              )}
            </button>
            {cloudError && (
              <p className="text-[12px] text-error">{cloudError}</p>
            )}
          </form>
        </div>
      </details>
    </div>
  );
}
