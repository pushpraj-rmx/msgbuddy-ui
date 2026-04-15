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

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

type StatusErrorBody = { statusCode?: number; message?: string };

function ConnectionRow({
  connection,
}: {
  connection: WhatsAppConnection;
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

  return (
    <div className="card card-border bg-base-200">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold truncate">{displayPhone}</h3>
              {connection.isDefault ? (
                <span className="badge badge-primary">Default</span>
              ) : null}
              {connection.status ? (
                <span className="badge badge-ghost">{connection.status}</span>
              ) : null}
            </div>
            <div className="text-xs text-base-content/60 truncate">
              Phone number id: {connection.phoneNumberId}
              {connection.wabaId ? ` · WABA: ${connection.wabaId}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => phoneStatusQuery.refetch()}
            disabled={!phoneStatusQuery.isFetched || phoneStatusQuery.isFetching}
          >
            {phoneStatusQuery.isFetching ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Refreshing…
              </>
            ) : (
              "Refresh status"
            )}
          </button>
        </div>

        {phoneStatusQuery.isLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        ) : errorStatus === 404 ? (
          <div role="alert" className="alert alert-info alert-soft">
            <span>WhatsApp not connected for this workspace.</span>
          </div>
        ) : errorStatus === 422 ? (
          <div role="alert" className="alert alert-warning alert-soft">
            <div className="space-y-1">
              <div>WhatsApp connection inactive.</div>
              <div className="text-sm opacity-70">{errorMessage}</div>
            </div>
          </div>
        ) : phoneStatusQuery.isError ? (
          <div role="alert" className="alert alert-error alert-soft">
            <details className="collapse collapse-arrow bg-base-100/40">
              <summary className="collapse-title text-sm font-medium">
                Failed to load status (click for details)
              </summary>
              <div className="collapse-content">
                <pre className="text-xs whitespace-pre-wrap text-base-content/70">
                  {errorMessage}
                </pre>
              </div>
            </details>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-base-content/60">Verified name</div>
              <div className="font-medium">{statusData?.verifiedName || "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-base-content/60">Verification</div>
              <div className="font-medium">
                {statusData?.verificationStatus || "Unknown"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-base-content/60">Quality</div>
              <div className="font-medium">{statusData?.qualityRating || "Unknown"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-base-content/60">Meta status</div>
              <div className="font-medium">{statusData?.status || "Unknown"}</div>
            </div>
          </div>
        )}

        <WhatsAppOnboardingPanel
          phoneNumberId={connection.phoneNumberId}
          registrationPending={connection.registrationPending}
          metaPhoneStatus={connection.metaPhoneStatus ?? undefined}
          metaVerificationStatus={connection.metaVerificationStatus ?? undefined}
        />
      </div>
    </div>
  );
}

export function WhatsAppSettingsClient({
  workspaceId,
  settings: _settings,
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
  const atLimit = (connectionsQuery.data?.length ?? 0) >= maxNumbers;

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
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Templates</div>
            <div className="text-sm text-base-content/70">
              Import existing WhatsApp templates from Meta into MsgBuddy.
            </div>
          </div>
          <Link
            className="btn btn-outline btn-sm"
            href="/settings/integrations/whatsapp/import-templates?returnTo=%2Fsettings%2Fintegrations%2Fwhatsapp"
          >
            Import from Meta
          </Link>
        </div>
      </div>

      <WhatsAppIntegrationPage
        variant="connectOnly"
        initialCloudApiConfig={cloudApiConfigState}
        atLimit={atLimit}
        onConnected={async () => {
          await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connections"] });
        }}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Connected numbers</h2>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => connectionsQuery.refetch()}
            disabled={connectionsQuery.isFetching}
          >
            {connectionsQuery.isFetching ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Refreshing…
              </>
            ) : (
              "Refresh list"
            )}
          </button>
        </div>

        {connectionsQuery.isLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : connectionsQuery.isError ? (
          <div role="alert" className="alert alert-error alert-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <span>Failed to load WhatsApp connections.</span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => connectionsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : !connectionsQuery.data?.length ? (
          <div role="alert" className="alert alert-info alert-soft">
            <span>No WhatsApp numbers connected yet.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {connectionsQuery.data.map((conn) => (
              <div key={conn.id} className="space-y-2">
                <ConnectionRow connection={conn} />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-error btn-outline"
                    onClick={() => disconnectMutation.mutate(conn.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Disconnecting…
                      </>
                    ) : (
                      "Disconnect"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Meta Cloud API</h2>
            <p className="text-sm text-base-content/60">
              Phone number ID and WABA ID. Access token is encrypted and not shown;
              add a new token to update.
            </p>
            {cloudApiConfigState && (
              <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-base-content/60">Status:</span>
                  <span
                    className={`badge ${
                      cloudApiConfigState.status === "ACTIVE"
                        ? "badge-success"
                        : cloudApiConfigState.status === "EXPIRED"
                          ? "badge-warning"
                          : "badge-ghost"
                    }`}
                  >
                    {cloudApiConfigState.status}
                  </span>
                </div>
                {cloudApiConfigState.tokenExpiresAt && (
                  <p className="text-sm text-base-content/60">
                    Token expires:{" "}
                    {new Date(cloudApiConfigState.tokenExpiresAt).toLocaleString()}
                  </p>
                )}
                <p className="text-sm text-base-content/60">
                  Access token: {cloudApiConfigState.hasAccessToken ? "Set" : "Not set"}
                </p>
              </div>
            )}
            <form onSubmit={handleCloudSubmit} className="space-y-4 mt-4">
              <label className="form-control">
                <span className="label">Phone number ID</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={cloudForm.phoneNumberId}
                  onChange={(e) =>
                    setCloudForm((p) => ({ ...p, phoneNumberId: e.target.value }))
                  }
                  required
                  placeholder="e.g. 123456789"
                />
              </label>
              <label className="form-control">
                <span className="label">WABA ID</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={cloudForm.wabaId}
                  onChange={(e) => setCloudForm((p) => ({ ...p, wabaId: e.target.value }))}
                  required
                  placeholder="WhatsApp Business Account ID"
                />
              </label>
              <label className="form-control">
                <span className="label">Access token (optional, to set or update)</span>
                <input
                  type="password"
                  className="input input-bordered"
                  value={cloudForm.accessToken}
                  onChange={(e) =>
                    setCloudForm((p) => ({ ...p, accessToken: e.target.value }))
                  }
                  placeholder="Leave blank to keep existing"
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={cloudSaving}>
                {cloudSaving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Save Cloud API config"
                )}
              </button>
              {cloudError && (
                <div role="alert" className="alert alert-error">
                  <span>{cloudError}</span>
                </div>
              )}
            </form>
          </div>
      </div>
    </div>
  );
}

