"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type UpdateWorkspaceDto, workspaceApi } from "@/lib/api";
import type { Workspace, WorkspaceSettings } from "@/components/settings/types";

export function WorkspaceGeneralClient({
  workspace,
  settings,
  memberCount,
}: {
  workspace: Workspace;
  settings: WorkspaceSettings;
  memberCount: number;
}) {
  const router = useRouter();

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

  return (
    <section className="space-y-3">
      <span className="op-section-title">Workspace</span>
      <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Name" value={workspace.name} />
          <InfoRow label="Slug" value={workspace.slug} />
          <InfoRow label="Status" value={workspace.status || "Active"} />
          <InfoRow label="Timezone" value={settings.timezone || workspace.timezone} />
          <InfoRow label="Locale" value={settings.locale || workspace.locale} />
          <InfoRow
            label="Members"
            value={`${memberCount} member${memberCount === 1 ? "" : "s"}`}
          />
        </div>
        {workspace.description && (
          <p className="text-[0.75rem] text-base-content/50">{workspace.description}</p>
        )}
        <div className="flex items-center justify-end border-t border-base-300 pt-3">
          <button type="button" className="btn btn-primary btn-sm" onClick={openEdit}>
            Edit workspace
          </button>
        </div>
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
            <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
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
    </section>
  );
}

/* ── Helper components ────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value?: string }) {
  const display = value?.trim();
  return (
    <div className="space-y-0.5 px-1">
      <span className="op-label">{label}</span>
      <p className="text-[0.8125rem] font-medium text-base-content truncate">{display || "—"}</p>
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
