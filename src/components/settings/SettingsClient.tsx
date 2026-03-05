"use client";

import { useState } from "react";
import {
  workspaceApi,
  type WorkspaceProviderType,
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceMessagingConfigPayload,
  type WorkspaceSettingsPayload,
  type WorkspaceCloudApiConfigPayload,
} from "@/lib/api";

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  timezone?: string;
  locale?: string;
  status?: string;
};

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

export type Member = {
  id: string;
  role: string;
  user?: { email?: string };
};

const TABS = ["Workspace info", "Members", "WhatsApp"] as const;

export function SettingsClient({
  workspaceId,
  workspace,
  settings,
  members,
  messagingConfig,
  cloudApiConfig,
}: {
  workspaceId: string;
  workspace: Workspace;
  settings: WorkspaceSettings;
  members: Member[];
  messagingConfig: WorkspaceMessagingConfigPayload;
  cloudApiConfig: WorkspaceCloudApiConfigResponse | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Workspace info");
  const [providerType, setProviderType] =
    useState<WorkspaceProviderType>(messagingConfig.providerType);
  const [messagingSaving, setMessagingSaving] = useState(false);
  const [messagingError, setMessagingError] = useState<string | null>(null);
  // TODO: BSP | BSP form state; complete BSP-specific validation/UX later
  const [bspForm, setBspForm] = useState({
    whatsappPhoneNumberId: settings.whatsappPhoneNumberId ?? "",
    whatsappBusinessId: settings.whatsappBusinessId ?? "",
    whatsappAccessToken: settings.whatsappAccessToken ?? "",
    whatsappWebhookSecret: settings.whatsappWebhookSecret ?? "",
  });
  const [bspSaving, setBspSaving] = useState(false);
  const [bspError, setBspError] = useState<string | null>(null);
  const [cloudForm, setCloudForm] = useState({
    phoneNumberId: cloudApiConfig?.phoneNumberId ?? "",
    wabaId: cloudApiConfig?.wabaId ?? "",
    accessToken: "",
  });
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudApiConfigState, setCloudApiConfigState] =
    useState<WorkspaceCloudApiConfigResponse | null>(cloudApiConfig);

  const handleProviderChange = async (next: WorkspaceProviderType) => {
    setMessagingError(null);
    setMessagingSaving(true);
    try {
      await workspaceApi.updateMessagingConfig(workspaceId, {
        providerType: next,
      });
      setProviderType(next);
    } catch (e) {
      setMessagingError(
        e instanceof Error ? e.message : "Failed to update provider"
      );
    } finally {
      setMessagingSaving(false);
    }
  };

  // TODO: BSP | Save BSP WhatsApp credentials; add validation / success feedback later
  const handleBspSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBspError(null);
    setBspSaving(true);
    try {
      await workspaceApi.updateSettings(workspaceId, {
        whatsappPhoneNumberId: bspForm.whatsappPhoneNumberId || undefined,
        whatsappBusinessId: bspForm.whatsappBusinessId || undefined,
        whatsappAccessToken: bspForm.whatsappAccessToken || undefined,
        whatsappWebhookSecret: bspForm.whatsappWebhookSecret || undefined,
      });
    } catch (e) {
      setBspError(
        e instanceof Error ? e.message : "Failed to save BSP settings"
      );
    } finally {
      setBspSaving(false);
    }
  };

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
      const updated = await workspaceApi.updateCloudApiConfig(
        workspaceId,
        payload
      );
      setCloudApiConfigState(updated);
      setCloudForm((prev) => ({ ...prev, accessToken: "" }));
    } catch (e) {
      setCloudError(
        e instanceof Error ? e.message : "Failed to save Cloud API config"
      );
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div role="tablist" className="tabs tabs-box">
        {TABS.map((label) => (
          <button
            key={label}
            role="tab"
            className={`tab ${tab === label ? "tab-active" : ""}`}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "Workspace info" && (
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Name" value={workspace.name} />
          <InfoCard label="Slug" value={workspace.slug} />
          <InfoCard label="Description" value={workspace.description} />
          <InfoCard label="Status" value={workspace.status} />
          <InfoCard
            label="Timezone"
            value={settings.timezone || workspace.timezone}
          />
          <InfoCard
            label="Locale"
            value={settings.locale || workspace.locale}
          />
        </div>
      )}

      {tab === "Members" && (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.user?.email || "Unknown"}</td>
                  <td>{member.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && (
            <div className="p-4 text-sm text-base-content/60">
              No members found.
            </div>
          )}
        </div>
      )}

      {tab === "WhatsApp" && (
        <div className="space-y-6">
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">Provider</h2>
              {/* TODO: BSP | Provider choice; BSP (legacy) path can be completed later */}
              <p className="text-sm text-base-content/60">
                Choose BSP (legacy) or Meta Cloud API for WhatsApp.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    name="provider"
                    className="radio radio-primary"
                    checked={providerType === "BSP"}
                    onChange={() => handleProviderChange("BSP")}
                    disabled={messagingSaving}
                  />
                  <span>BSP (legacy)</span>
                </label>
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    name="provider"
                    className="radio radio-primary"
                    checked={providerType === "CLOUD_API"}
                    onChange={() => handleProviderChange("CLOUD_API")}
                    disabled={messagingSaving}
                  />
                  <span>Cloud API</span>
                </label>
              </div>
              {messagingSaving && (
                <span className="loading loading-spinner loading-sm" />
              )}
              {messagingError && (
                <div role="alert" className="alert alert-error">
                  <span>{messagingError}</span>
                </div>
              )}
            </div>
          </div>

          {/* TODO: BSP | BSP WhatsApp form block; finish field validation, masking, and copy behavior later */}
          {providerType === "BSP" && (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg">BSP WhatsApp</h2>
                <p className="text-sm text-base-content/60">
                  Phone number ID, Business ID, access token, and webhook secret
                  (stored in workspace settings).
                </p>
                <form onSubmit={handleBspSubmit} className="space-y-4">
                  <label className="form-control">
                    <span className="label">Phone number ID</span>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={bspForm.whatsappPhoneNumberId}
                      onChange={(e) =>
                        setBspForm((p) => ({
                          ...p,
                          whatsappPhoneNumberId: e.target.value,
                        }))
                      }
                      placeholder="e.g. 123456789"
                    />
                  </label>
                  <label className="form-control">
                    <span className="label">Business ID</span>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={bspForm.whatsappBusinessId}
                      onChange={(e) =>
                        setBspForm((p) => ({
                          ...p,
                          whatsappBusinessId: e.target.value,
                        }))
                      }
                      placeholder="e.g. 123456789012345"
                    />
                  </label>
                  <label className="form-control">
                    <span className="label">Access token</span>
                    <input
                      type="password"
                      className="input input-bordered"
                      value={bspForm.whatsappAccessToken}
                      onChange={(e) =>
                        setBspForm((p) => ({
                          ...p,
                          whatsappAccessToken: e.target.value,
                        }))
                      }
                      placeholder="Permanent or temporary token"
                    />
                  </label>
                  <label className="form-control">
                    <span className="label">Webhook secret</span>
                    <input
                      type="password"
                      className="input input-bordered"
                      value={bspForm.whatsappWebhookSecret}
                      onChange={(e) =>
                        setBspForm((p) => ({
                          ...p,
                          whatsappWebhookSecret: e.target.value,
                        }))
                      }
                      placeholder="App secret or custom verify token"
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bspSaving}
                  >
                    {bspSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Save BSP settings"
                    )}
                  </button>
                  {bspError && (
                    <div role="alert" className="alert alert-error">
                      <span>{bspError}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {providerType === "CLOUD_API" && (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg">Meta Cloud API</h2>
                <p className="text-sm text-base-content/60">
                  Phone number ID and WABA ID. Access token is encrypted and not
                  shown; add a new token to update.
                </p>
                {cloudApiConfigState && (
                  <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-base-content/60">
                        Status:
                      </span>
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
                        {new Date(
                          cloudApiConfigState.tokenExpiresAt
                        ).toLocaleString()}
                      </p>
                    )}
                    <p className="text-sm text-base-content/60">
                      Access token:{" "}
                      {cloudApiConfigState.hasAccessToken ? "Set" : "Not set"}
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
                        setCloudForm((p) => ({
                          ...p,
                          phoneNumberId: e.target.value,
                        }))
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
                      onChange={(e) =>
                        setCloudForm((p) => ({
                          ...p,
                          wabaId: e.target.value,
                        }))
                      }
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
                        setCloudForm((p) => ({
                          ...p,
                          accessToken: e.target.value,
                        }))
                      }
                      placeholder="Leave blank to keep existing"
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={cloudSaving}
                  >
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
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="text-lg font-semibold">{value || "-"}</div>
      </div>
    </div>
  );
}
