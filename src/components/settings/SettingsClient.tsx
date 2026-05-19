"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import {
  type WhatsAppConnectionSummary,
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceSettingsPayload,
  type UpdateWorkspaceDto,
  workspaceApi,
} from "@/lib/api";
import { AccountSecurityClient } from "@/components/settings/AccountSecurityClient";
import { DisplayPreferencesClient } from "@/components/settings/DisplayPreferencesClient";
import { PurgeContactsClient } from "@/components/settings/PurgeContactsClient";
import { TeamClient } from "@/components/settings/TeamClient";
import type { DisplayDensity, LoginHistoryEvent } from "@/lib/api";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { canDeleteWorkspace } from "@/lib/workspace-access";

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  businessId?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  timezone?: string;
  locale?: string;
  businessName?: string;
  industry?: string;
  country?: string;
  phone?: string;
  email?: string;
  businessAddress?: string;
  businessAbout?: string;
  businessVertical?: string;
  status?: string;
};

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

export type Member = {
  id: string;
  role: string;
  user?: { id?: string; email?: string; name?: string | null };
};

function isWhatsAppConnected(config: WorkspaceCloudApiConfigResponse | null): boolean {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken === true);
}

export function SettingsClient({
  workspace,
  settings,
  members,
  cloudApiConfig,
  whatsappConnection,
  meRole,
  meUserId,
  accountEmail,
  accountName,
  accountAvatarUrl,
  hasPassword,
  displayDensity,
  loginHistory,
}: {
  workspace: Workspace;
  settings: WorkspaceSettings;
  members: Member[];
  cloudApiConfig: WorkspaceCloudApiConfigResponse | null;
  whatsappConnection: WhatsAppConnectionSummary | null;
  meRole: string;
  meUserId?: string;
  accountEmail: string;
  accountName?: string;
  accountAvatarUrl?: string | null;
  hasPassword: boolean;
  displayDensity: DisplayDensity;
  loginHistory: LoginHistoryEvent[];
}) {
  const router = useRouter();
  const canManageWorkspace = roleHasWorkspacePermission(meRole, "settings.manage");
  const canViewMembers = roleHasWorkspacePermission(meRole, "members.view");
  const canDeleteWorkspaceAction = canDeleteWorkspace(meRole);

  const initialForm = useMemo(
    () => ({
      name: workspace.name ?? "",
      description: workspace.description ?? "",
      logoUrl: workspace.logoUrl ?? "",
      website: workspace.website ?? "",
      timezone: settings.timezone || workspace.timezone || "",
      locale: settings.locale || workspace.locale || "",
      businessName: workspace.businessName ?? "",
      industry: workspace.industry ?? "",
      country: workspace.country ?? "",
      phone: workspace.phone ?? "",
      email: workspace.email ?? "",
      businessAddress: workspace.businessAddress ?? "",
      businessAbout: workspace.businessAbout ?? "",
      businessVertical: workspace.businessVertical ?? "",
    }),
    [settings.locale, settings.timezone, workspace]
  );

  const [saving, setSaving] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Chatbot form state
  const [chatbotForm, setChatbotForm] = useState({
    chatbotEnabled: settings.chatbotEnabled ?? false,
    chatbotSystemPrompt: settings.chatbotSystemPrompt ?? "",
    chatbotApiKey: "",
    chatbotProvider: settings.chatbotProvider ?? "anthropic",
    chatbotModel: settings.chatbotModel ?? "claude-sonnet-4-20250514",
  });
  const [savingChatbot, setSavingChatbot] = useState(false);
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [chatbotSaved, setChatbotSaved] = useState(false);

  const onSaveChatbot = async () => {
    setSavingChatbot(true);
    setChatbotError(null);
    setChatbotSaved(false);
    try {
      const payload: Partial<WorkspaceSettingsPayload> = {
        chatbotEnabled: chatbotForm.chatbotEnabled,
        chatbotSystemPrompt: chatbotForm.chatbotSystemPrompt.trim() || undefined,
        chatbotProvider: chatbotForm.chatbotProvider,
        chatbotModel: chatbotForm.chatbotModel,
      };
      if (chatbotForm.chatbotApiKey.trim()) {
        payload.chatbotApiKey = chatbotForm.chatbotApiKey.trim();
      }
      await workspaceApi.updateSettings(workspace.id, payload);
      setChatbotForm((s) => ({ ...s, chatbotApiKey: "" }));
      setChatbotSaved(true);
      router.refresh();
    } catch (e) {
      setChatbotError(e instanceof Error ? e.message : "Failed to save chatbot settings");
    } finally {
      setSavingChatbot(false);
    }
  };

  const openEdit = () => {
    setForm(initialForm);
    setError(null);
    (document.getElementById("edit_workspace_modal") as HTMLDialogElement | null)?.showModal();
  };

  const closeEdit = () => {
    (document.getElementById("edit_workspace_modal") as HTMLDialogElement | null)?.close();
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateWorkspaceDto = {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        website: form.website.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        locale: form.locale.trim() || undefined,
        businessName: form.businessName.trim() || undefined,
        industry: form.industry.trim() || undefined,
        country: form.country.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        businessAddress: form.businessAddress.trim() || undefined,
        businessAbout: form.businessAbout.trim() || undefined,
        businessVertical: form.businessVertical.trim() || undefined,
      };
      await workspaceApi.updateWorkspace(workspace.id, payload);
      closeEdit();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update workspace");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteWorkspace = async () => {
    if (!canDeleteWorkspaceAction) return;
    setDangerBusy(true);
    try {
      await workspaceApi.deleteWorkspace(workspace.id);
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete workspace");
    } finally {
      setDangerBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="space-y-8">
        {/* ── Page header ── */}
        <header>
          <span className="op-label">settings</span>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">
            Workspace Settings
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-base-content/55">
            Configure your account, workspace, and integrations.
          </p>
        </header>

        {/* ── Account & Security ── */}
        <section id="account-security" className="space-y-3">
          <span className="op-section-title">Account &amp; Security</span>
          <AccountSecurityClient
            accountEmail={accountEmail}
            accountName={accountName}
            accountAvatarUrl={accountAvatarUrl}
            hasPassword={hasPassword}
            loginHistory={loginHistory}
          />
        </section>

        {/* ── Display ── */}
        <section id="display" className="space-y-3">
          <span className="op-section-title">Display</span>
          <DisplayPreferencesClient initialDensity={displayDensity} />
        </section>

        {/* ── Workspace Info ── */}
        <section id="workspace-info" className="space-y-3">
          <span className="op-section-title">Workspace</span>
          {canManageWorkspace ? (
            <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Name" value={workspace.name} />
                <InfoRow label="Slug" value={workspace.slug} />
                <InfoRow label="Status" value={workspace.status || "Active"} />
                <InfoRow label="Timezone" value={settings.timezone || workspace.timezone} />
                <InfoRow label="Locale" value={settings.locale || workspace.locale} />
                <InfoRow
                  label="Members"
                  value={`${members.length} member${members.length === 1 ? "" : "s"}`}
                />
              </div>
              {workspace.description && (
                <p className="text-[0.75rem] text-base-content/50">{workspace.description}</p>
              )}
              <div className="flex items-center justify-end border-t border-base-300 pt-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openEdit}
                >
                  Edit workspace
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3 text-[0.8125rem] text-base-content/55">
              You do not have permission to change workspace settings.
            </div>
          )}
        </section>

        {/* ── Team Members ── */}
        {canViewMembers ? (
          <section id="team-members" className="space-y-3">
            <span className="op-section-title">Team Members</span>
            <TeamClient
              workspaceId={workspace.id}
              initialMembers={members}
              meRole={meRole}
              meUserId={meUserId}
            />
          </section>
        ) : null}

        {/* ── WhatsApp Integration ── */}
        <section id="whatsapp-integration" className="space-y-3">
          <span className="op-section-title">WhatsApp</span>
          <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.875rem] font-semibold">Cloud API</span>
                  <span className={isWhatsAppConnected(cloudApiConfig) ? "op-tag op-tag-ok" : "op-tag"}>
                    {isWhatsAppConnected(cloudApiConfig) ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <p className="text-[0.75rem] text-base-content/55">
                  Manage conversations, templates, and automation from dashboard.
                </p>
              </div>
              {canManageWorkspace ? (
                <a
                  href="/settings/integrations/whatsapp"
                  className="btn btn-outline btn-sm"
                >
                  Manage
                </a>
              ) : null}
            </div>

            <div className="grid gap-px overflow-hidden rounded-box border border-base-300 bg-base-300 sm:grid-cols-3">
              <StatCell
                label="Number"
                value={
                  whatsappConnection?.displayPhoneNumber ||
                  whatsappConnection?.phoneNumberId ||
                  cloudApiConfig?.phoneNumberId ||
                  workspace.phone ||
                  "—"
                }
              />
              <StatCell
                label="WABA ID"
                value={whatsappConnection?.wabaId || cloudApiConfig?.wabaId || "—"}
              />
              <StatCell
                label="Business ID"
                value={whatsappConnection?.businessId || workspace.businessId || "—"}
              />
            </div>
          </div>
        </section>

        {/* ── Developers (API keys) ── */}
        {canManageWorkspace ? (
          <section id="developers" className="space-y-3">
            <span className="op-section-title">Developers</span>
            <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.875rem] font-semibold">API keys</span>
                    <span className="op-tag">
                      mb_live_…  ●●●●  ????
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-base-content/55">
                    Generate keys for external apps to send messages and
                    receive webhook events on this workspace&apos;s behalf.
                  </p>
                </div>
                <a
                  href="/settings/developers"
                  className="btn btn-outline btn-sm"
                >
                  Manage keys
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Webhooks (outbound events) ── */}
        {canManageWorkspace ? (
          <section id="webhooks" className="space-y-3">
            <span className="op-section-title">Webhooks</span>
            <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.875rem] font-semibold">
                      Outbound endpoints
                    </span>
                    <span className="op-tag">
                      X-MsgBuddy-Signature
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-base-content/55">
                    Push message and template events into your app in
                    real time. HMAC-SHA256 signed; auto-disable on
                    sustained failure; replay supported.
                  </p>
                </div>
                <a
                  href="/settings/webhooks"
                  className="btn btn-outline btn-sm"
                >
                  Manage webhooks
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Chatbot ── */}
        {canManageWorkspace ? (
          <section id="chatbot" className="space-y-3">
            <span className="op-section-title">Chatbot</span>
            <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.875rem] font-semibold">LLM Auto-Reply</span>
                    <span className={chatbotForm.chatbotEnabled ? "op-tag op-tag-ok" : "op-tag"}>
                      {chatbotForm.chatbotEnabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-base-content/55">
                    Automatically replies to unassigned conversations using an LLM.
                    Stops when an agent claims the conversation.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[0.75rem] text-base-content/55">Enabled</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm toggle-primary"
                    checked={chatbotForm.chatbotEnabled}
                    onChange={(e) =>
                      setChatbotForm((s) => ({ ...s, chatbotEnabled: e.target.checked }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="form-control w-full">
                  <span className="op-label mb-1">Provider</span>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={chatbotForm.chatbotProvider}
                    onChange={(e) =>
                      setChatbotForm((s) => ({ ...s, chatbotProvider: e.target.value }))
                    }
                  >
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>

                <label className="form-control w-full">
                  <span className="op-label mb-1">Model</span>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={chatbotForm.chatbotModel}
                    onChange={(e) =>
                      setChatbotForm((s) => ({ ...s, chatbotModel: e.target.value }))
                    }
                  >
                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                  </select>
                </label>
              </div>

              <label className="form-control w-full">
                <span className="op-label mb-1">
                  API Key
                  {settings.hasChatbotApiKey ? (
                    <span className="ml-2 text-success">Key saved</span>
                  ) : null}
                </span>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="sk-ant-..."
                  value={chatbotForm.chatbotApiKey}
                  onChange={(e) =>
                    setChatbotForm((s) => ({ ...s, chatbotApiKey: e.target.value }))
                  }
                />
                <span className="mt-1 text-[0.6875rem] text-base-content/40">
                  Leave blank to keep the existing key. Enter a new value to replace it.
                </span>
              </label>

              <label className="form-control w-full">
                <span className="op-label mb-1">System Prompt</span>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  rows={4}
                  placeholder="You are a helpful customer support assistant for [Company]. Be concise, friendly, and helpful..."
                  value={chatbotForm.chatbotSystemPrompt}
                  onChange={(e) =>
                    setChatbotForm((s) => ({ ...s, chatbotSystemPrompt: e.target.value }))
                  }
                />
              </label>

              {chatbotError ? (
                <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
                  <span className="op-label mb-1 block text-error">error</span>
                  <p className="text-[0.8125rem]">{chatbotError}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-base-300 pt-3">
                {chatbotSaved ? (
                  <span className="text-[0.75rem] text-success">Saved.</span>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onSaveChatbot}
                  disabled={savingChatbot}
                >
                  {savingChatbot ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      Saving…
                    </>
                  ) : (
                    "Save chatbot settings"
                  )}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Danger zone ── */}
        {canDeleteWorkspaceAction ? (
          <section className="space-y-3" id="danger-zone">
            <span className="op-section-title text-error">Danger zone</span>
            <div className="space-y-3">
              <div className="rounded-box border border-error/20 bg-base-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.875rem] font-semibold">Archive workspace</p>
                    <p className="mt-0.5 text-[0.75rem] text-base-content/55">
                      Pauses all integrations and automation. Reactivate anytime.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline btn-error"
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={dangerBusy}
                  >
                    {dangerBusy ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Archiving…
                      </>
                    ) : (
                      "Archive"
                    )}
                  </button>
                </div>
              </div>

              <PurgeContactsClient workspaceName={workspace.name} />
            </div>
          </section>
        ) : null}
      </div>

      {/* ── Edit workspace modal ── */}
      <dialog id="edit_workspace_modal" className="modal modal-middle">
        <div className="modal-box max-w-3xl">
          <span className="op-label mb-1 block">workspace</span>
          <h3 className="text-[1.0625rem] font-semibold">Edit workspace</h3>
          <p className="mt-0.5 text-[0.78125rem] text-base-content/55">
            Changes apply to the entire workspace.
          </p>

          {error ? (
            <div className="mt-4 rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
              <span className="op-label mb-1 block text-error">error</span>
              <p className="text-[0.8125rem]">{error}</p>
            </div>
          ) : null}

          <details
            open
            className="group mt-4 rounded-box border border-base-300 bg-base-200/30"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-[0.8125rem] font-semibold">
              General
            </summary>
            <div className="border-t border-base-300 px-4 py-3">
              <div className="grid gap-3 md:grid-cols-2">
                <ModalField label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
                <ModalField label="Website" value={form.website} onChange={(v) => setForm((s) => ({ ...s, website: v }))} />
                <ModalField label="Description" value={form.description} onChange={(v) => setForm((s) => ({ ...s, description: v }))} fullWidth textarea />
                <ModalField label="Timezone" value={form.timezone} onChange={(v) => setForm((s) => ({ ...s, timezone: v }))} />
                <ModalField label="Locale" value={form.locale} onChange={(v) => setForm((s) => ({ ...s, locale: v }))} />
                <ModalField label="Logo URL" value={form.logoUrl} onChange={(v) => setForm((s) => ({ ...s, logoUrl: v }))} fullWidth />
              </div>
            </div>
          </details>

          <details className="group mt-3 rounded-box border border-base-300 bg-base-200/30">
            <summary className="cursor-pointer select-none px-4 py-3 text-[0.8125rem] font-semibold">
              Business profile
            </summary>
            <div className="border-t border-base-300 px-4 py-3">
              <div className="grid gap-3 md:grid-cols-2">
                <ModalField label="Business name" value={form.businessName} onChange={(v) => setForm((s) => ({ ...s, businessName: v }))} />
                <ModalField label="Industry" value={form.industry} onChange={(v) => setForm((s) => ({ ...s, industry: v }))} />
                <ModalField label="Country" value={form.country} onChange={(v) => setForm((s) => ({ ...s, country: v }))} />
                <ModalField label="Phone" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
                <ModalField label="Billing email" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
                <ModalField label="Vertical" value={form.businessVertical} onChange={(v) => setForm((s) => ({ ...s, businessVertical: v }))} />
                <ModalField label="Business address" value={form.businessAddress} onChange={(v) => setForm((s) => ({ ...s, businessAddress: v }))} fullWidth />
                <ModalField label="About" value={form.businessAbout} onChange={(v) => setForm((s) => ({ ...s, businessAbout: v }))} fullWidth textarea />
              </div>
            </div>
          </details>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="close">close</button>
        </form>
      </dialog>

      <ConfirmDialog
        open={showConfirmDelete}
        title="Archive this workspace?"
        description="This is a soft-delete, but it will immediately block access."
        confirmLabel="Archive Workspace"
        tone="warning"
        loading={dangerBusy}
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDeleteWorkspace();
        }}
        onClose={() => setShowConfirmDelete(false)}
      />
    </section>
  );
}

/* ── Helper components ────────────────────────────────────────── */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  const display = value?.trim();
  return (
    <div className="space-y-0.5 px-1">
      <span className="op-label">{label}</span>
      <p className="text-[0.8125rem] font-medium text-base-content truncate">
        {display || "—"}
      </p>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-200 px-3 py-2.5">
      <span className="op-label">{label}</span>
      <p className="mt-0.5 text-[0.8125rem] font-medium tabular-nums truncate">{value}</p>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  fullWidth = false,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className={`form-control w-full ${fullWidth ? "md:col-span-2" : ""}`}>
      <span className="op-label mb-1">{label}</span>
      {textarea ? (
        <textarea
          className="textarea textarea-bordered textarea-sm w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input input-bordered input-sm w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
