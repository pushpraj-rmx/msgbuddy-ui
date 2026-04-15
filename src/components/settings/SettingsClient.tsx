"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Building2, Users, MessageCircle } from "lucide-react";
import {
  type WhatsAppConnectionSummary,
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceSettingsPayload,
  type UpdateWorkspaceDto,
  workspaceApi,
} from "@/lib/api";
import { AccountSecurityClient } from "@/components/settings/AccountSecurityClient";
import { TeamClient } from "@/components/settings/TeamClient";
import type { LoginHistoryEvent } from "@/lib/api";
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
    const ok = window.confirm(
      "Delete this workspace? This is a soft-delete, but it will immediately block access."
    );
    if (!ok) return;
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
      <div className="space-y-6">
          <header className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-base-content">Workspace Settings</h1>
            <p className="text-base text-base-content/65">
              Configure your account, workspace, and integrations.
            </p>
          </header>

          <section id="account-security" className="space-y-3">
            <div className="flex items-center gap-2 text-base-content">
              <ShieldCheck className="h-5 w-5 text-success" />
              <h2 className="text-2xl font-semibold tracking-tight">Account &amp; Security</h2>
            </div>
            <AccountSecurityClient
              accountEmail={accountEmail}
              accountName={accountName}
              accountAvatarUrl={accountAvatarUrl}
              hasPassword={hasPassword}
              loginHistory={loginHistory}
            />
          </section>

          <section id="workspace-info" className="space-y-3">
            <div className="flex items-center gap-2 text-base-content">
              <Building2 className="h-5 w-5 text-success" />
              <h2 className="text-2xl font-semibold tracking-tight">Workspace Info</h2>
            </div>
            {canManageWorkspace ? (
              <div className="space-y-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Workspace name" value={workspace.name} />
                  <InfoRow label="Workspace slug" value={workspace.slug} />
                  <InfoRow label="Workspace description" value={workspace.description} fullWidth />
                  <InfoRow label="Timezone" value={settings.timezone || workspace.timezone} />
                  <InfoRow label="Locale" value={settings.locale || workspace.locale} />
                  <InfoRow label="Status" value={workspace.status || "Active subscription"} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-4">
                  <p className="text-sm text-base-content/70">
                    Personal workspace • {members.length} member{members.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-success btn-sm px-5"
                      onClick={openEdit}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm text-base-content/80">
                You do not have permission to change workspace settings.
              </div>
            )}
          </section>

          {canViewMembers ? (
            <section id="team-members" className="space-y-3">
              <div className="flex items-center gap-2 text-base-content">
                <Users className="h-5 w-5 text-success" />
                <h2 className="text-2xl font-semibold tracking-tight">Team Members</h2>
              </div>
              <TeamClient
                workspaceId={workspace.id}
                initialMembers={members}
                meRole={meRole}
                meUserId={meUserId}
              />
            </section>
          ) : null}

          <section id="whatsapp-integration" className="space-y-3">
            <div className="flex items-center gap-2 text-base-content">
              <MessageCircle className="h-5 w-5 text-success" />
              <h2 className="text-2xl font-semibold tracking-tight">WhatsApp Integration</h2>
            </div>
            <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">WhatsApp Business Cloud API</h3>
                    <span
                      className={`badge badge-sm ${
                        isWhatsAppConnected(cloudApiConfig)
                          ? "badge-success badge-soft"
                          : "badge-ghost"
                      }`}
                    >
                      {isWhatsAppConnected(cloudApiConfig) ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <p className="text-sm text-base-content/65">
                    Instance synced. Manage conversations and automation from dashboard.
                  </p>
                </div>
                {canManageWorkspace ? (
                  <a
                    href="/settings/integrations/whatsapp"
                    className="btn btn-sm btn-ghost border border-base-300/80"
                  >
                    Configure Webhooks
                  </a>
                ) : null}
              </div>
              <div className="mt-4 grid rounded-xl border border-base-300 sm:grid-cols-3">
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

          {canDeleteWorkspaceAction ? (
            <section className="rounded-2xl border border-error/30 bg-base-100 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-error">Archive Workspace</h3>
                  <p className="text-sm text-base-content/70">
                    Pauses all integrations and automation. Reactivate anytime.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-error"
                  onClick={onDeleteWorkspace}
                  disabled={dangerBusy}
                >
                  {dangerBusy ? "Archiving..." : "Archive Workspace"}
                </button>
              </div>
            </section>
          ) : null}
      </div>

      <dialog id="edit_workspace_modal" className="modal">
        <div className="modal-box max-w-3xl">
          <h3 className="text-lg font-semibold">Edit workspace</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Changes apply to the entire workspace.
          </p>

          {error ? (
            <div role="alert" className="alert alert-error alert-soft mt-4">
              <span className="text-sm">{error}</span>
            </div>
          ) : null}

          <details
            open
            className="group mt-4 rounded-box border border-base-300 bg-base-200/20 p-4"
          >
            <summary className="cursor-pointer text-sm font-medium text-base-content">
              General
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Name</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Website</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.website}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, website: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text">Description</span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={form.description}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, description: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Timezone</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.timezone}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, timezone: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Locale</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.locale}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, locale: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text">Logo URL</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.logoUrl}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, logoUrl: e.target.value }))
                  }
                />
              </label>
            </div>
          </details>

          <details className="group mt-3 rounded-box border border-base-300 bg-base-200/20 p-4">
            <summary className="cursor-pointer text-sm font-medium text-base-content">
              Business profile
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Business name</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.businessName}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, businessName: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Industry</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.industry}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, industry: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Country</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.country}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, country: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Phone</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, phone: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Billing email</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.email}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, email: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text">Business address</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.businessAddress}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, businessAddress: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full md:col-span-2">
                <div className="label">
                  <span className="label-text">Business about</span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={form.businessAbout}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, businessAbout: e.target.value }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Vertical</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  value={form.businessVertical}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, businessVertical: e.target.value }))
                  }
                />
              </label>
            </div>
          </details>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={closeEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="close">close</button>
        </form>
      </dialog>
    </section>
  );
}

function InfoRow({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value?: string;
  fullWidth?: boolean;
}) {
  const display = value?.trim();
  return (
    <div className={`rounded-xl border border-base-300 bg-base-200/30 px-3 py-2.5 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">{label}</div>
      <div className="mt-1 min-w-0 break-words text-sm font-medium text-base-content">
        {display ? display : "—"}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-base-300 p-3 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-base-content">{value}</div>
    </div>
  );
}
