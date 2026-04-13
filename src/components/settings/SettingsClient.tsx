"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceSettingsPayload,
  type UpdateWorkspaceDto,
  workspaceApi,
} from "@/lib/api";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { AccountSecurityClient } from "@/components/settings/AccountSecurityClient";
import type { LoginHistoryEvent } from "@/lib/api";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
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
  meRole,
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
  meRole: string;
  accountEmail: string;
  accountName?: string;
  accountAvatarUrl?: string | null;
  hasPassword: boolean;
  loginHistory: LoginHistoryEvent[];
}) {
  const router = useRouter();
  const canManageWorkspace = roleHasWorkspacePermission(meRole, "settings.manage");
  const canDeleteWorkspace = meRole === "OWNER";

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
    if (!canDeleteWorkspace) return;
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
    <section className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Your account
        </p>
        <AccountSecurityClient
          accountEmail={accountEmail}
          accountName={accountName}
          accountAvatarUrl={accountAvatarUrl}
          hasPassword={hasPassword}
          memberCount={members.length}
          loginHistory={loginHistory}
          meRole={meRole}
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Workspace
        </p>
        {canManageWorkspace ? (
          <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">Workspace info</h2>
                <p className="mt-0.5 text-sm text-base-content/70">
                  {members.length} member{members.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={openEdit}
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-box border border-base-300">
              <InfoRow label="Name" value={workspace.name} />
              <InfoRow label="Slug" value={workspace.slug} />
              <InfoRow label="Description" value={workspace.description} />
              <InfoRow label="Status" value={workspace.status} />
              <InfoRow
                label="Timezone"
                value={settings.timezone || workspace.timezone}
              />
              <InfoRow label="Locale" value={settings.locale || workspace.locale} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-base-content/80">
                WhatsApp
              </h3>
              <IntegrationCard
                name="WhatsApp"
                description="Connect and monitor your WhatsApp Business phone number."
                status={
                  isWhatsAppConnected(cloudApiConfig)
                    ? "connected"
                    : "disconnected"
                }
                actionLabel={
                  isWhatsAppConnected(cloudApiConfig) ? "Manage" : "Connect"
                }
                href="/settings/integrations/whatsapp"
              />
            </div>

            {canDeleteWorkspace ? (
              <div className="border-t border-base-300 pt-4">
                <button
                  type="button"
                  className="btn btn-sm btn-error btn-outline"
                  onClick={onDeleteWorkspace}
                  disabled={dangerBusy}
                >
                  {dangerBusy ? "Deleting..." : "Delete workspace"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-box border border-base-300 bg-base-100 p-4 text-sm text-base-content/80">
            You don’t have permission to change workspace settings or integrations. Ask
            an owner or admin if you need updates.
          </div>
        )}
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

function InfoRow({ label, value }: { label: string; value?: string }) {
  const display = value?.trim();
  return (
    <div className="flex flex-col gap-0.5 border-b border-base-300 px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <div className="shrink-0 text-xs text-base-content/60 sm:w-36">{label}</div>
      <div className="min-w-0 break-words text-sm font-medium text-base-content">
        {display ? display : "—"}
      </div>
    </div>
  );
}
