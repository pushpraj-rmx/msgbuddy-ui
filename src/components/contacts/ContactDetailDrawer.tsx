"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Phone, Mail, Shield, ShieldOff, Pencil, Trash2,
  MessageSquare, Tag, FileText, Clock,
} from "lucide-react";
import { getApiError } from "@/lib/api-error";
import { contactsApi, tagsApi } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TagsPicker } from "./TagsPicker";
import { CustomFieldsSection } from "./CustomFieldsSection";

export function ContactDetailDrawer({
  contactId,
  initialContact,
  onClose,
  onEdit,
  inline = false,
}: {
  contactId: string;
  initialContact?: Contact | null;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  inline?: boolean;
}) {
  return (
    <>
      {!inline ? (
        <div
          className="fixed inset-0 z-40 bg-base-content/20"
          aria-hidden
          onClick={onClose}
        />
      ) : null}
      <aside
        className={
          inline
            ? "sticky top-0 flex h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
            : "fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden rounded-box border-l border-base-300 bg-base-100 shadow-lg sm:w-[400px]"
        }
        role="dialog"
        aria-label="Contact details"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-base-300 p-4 gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ContactDetailPanelContent
              contactId={contactId}
              initialContact={initialContact}
              onEdit={onEdit}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Contact info row — icon + label + value
   ───────────────────────────────────────────────────────────────── */
function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  mono,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  href?: string;
  mono?: boolean;
  muted?: boolean;
}) {
  const valClass = `text-[13px] ${mono ? "font-mono-op tabular-nums" : ""} ${muted ? "text-base-content/50" : "text-base-content"}`;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/50">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="op-label">{label}</span>
        {href ? (
          <a href={href} className={`${valClass} mt-0.5 block hover:text-primary transition-colors`}>
            {value}
          </a>
        ) : (
          <p className={`${valClass} mt-0.5`}>{value}</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Status chip — small inline indicator
   ───────────────────────────────────────────────────────────────── */
function StatusChip({
  active,
  label,
  activeColor = "text-warning",
  icon: Icon,
}: {
  active: boolean;
  label: string;
  activeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
        active
          ? `border-current/30 ${activeColor}`
          : "border-base-300 text-base-content/40"
      }`}
      title={label}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span className={`ml-auto font-mono-op text-[10px] ${active ? "" : "text-base-content/30"}`}>
        {active ? "ON" : "OFF"}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main panel content — renders inside the right panel
   ───────────────────────────────────────────────────────────────── */
export function ContactDetailPanelContent({
  contactId,
  initialContact,
  onEdit,
  onDeleted,
  canEdit = true,
  canDelete = true,
}: {
  contactId: string;
  initialContact?: Contact | null;
  onEdit: (contact: Contact) => void;
  onDeleted?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: contact = initialContact } = useQuery({
    queryKey: ["contacts", contactId],
    queryFn: () =>
      contactsApi.getOne(contactId, { include: "tags,customFields" }),
    enabled: !!contactId,
    initialData: initialContact ?? undefined,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
  });

  const invalidateContact = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts", contactId] });
    queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
  };

  const assignTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) => contactsApi.assignTags(contactId, tagIds),
    onSuccess: invalidateContact,
  });

  const removeTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) => contactsApi.removeTags(contactId, tagIds),
    onSuccess: invalidateContact,
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(contactId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
      setDeleteError(null);
      onDeleted?.();
      setDeleteConfirm(false);
    },
    onError: (err) => setDeleteError(getApiError(err)),
  });

  if (!contact) return null;

  const tags = contact.tags ?? [];
  const createdAt = contact.createdAt
    ? new Date(contact.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col">
      {/* ── Hero: avatar + name + phone/email + actions ── */}
      <div className="op-grain relative flex flex-col items-center gap-3 border-b border-base-300 bg-base-200 px-4 py-6">
        <ContactAvatar
          name={contact.name}
          phone={contact.phone}
          avatarUrl={contact.avatarUrl}
          size="lg"
        />
        <div className="text-center">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
            {contact.name || "Unnamed"}
          </h2>
          {contact.designation ? (
            <p className="mt-0.5 text-[12px] text-base-content/55">{contact.designation}</p>
          ) : null}
        </div>

        {/* Phone + Email inline */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 text-[12px] text-base-content/70">
            <Phone className="h-3 w-3 text-base-content/40" />
            <span className="font-mono-op tabular-nums">{contact.phone}</span>
            {contact.phoneLabel ? (
              <span className="text-base-content/40">· {contact.phoneLabel}</span>
            ) : null}
          </div>
          {contact.email ? (
            <div className="flex items-center gap-1.5 text-[12px]">
              <Mail className="h-3 w-3 text-base-content/40" />
              <a href={`mailto:${contact.email}`} className="text-base-content/70 hover:text-primary transition-colors">
                {contact.email}
              </a>
              {contact.emailLabel ? (
                <span className="text-base-content/40">· {contact.emailLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {canEdit ? (
            <div className="tooltip tooltip-bottom" data-tip="Edit contact">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => onEdit(contact)}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="tooltip tooltip-bottom" data-tip="Send message">
            <a
              href={`/inbox?contactId=${contact.id}`}
              className="btn btn-ghost btn-sm btn-square"
            >
              <MessageSquare className="h-4 w-4" />
            </a>
          </div>
          {canDelete ? (
            <div className="tooltip tooltip-bottom" data-tip="Delete contact">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square text-error/70 hover:text-error"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirm(true);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
        {deleteError ? (
          <p className="text-[12px] text-error" role="alert">{deleteError}</p>
        ) : null}
      </div>

      {/* ── Created date ── */}
      {createdAt ? (
        <div className="border-b border-base-300 px-4 py-3">
          <InfoRow icon={Clock} label="Created" value={createdAt} muted />
        </div>
      ) : null}


      {/* ── Consent status ── */}
      <div className="border-b border-base-300 px-4 py-3">
        <span className="op-label mb-2 block">Consent</span>
        <div className="flex gap-2">
          <StatusChip
            active={contact.isBlocked}
            label="Blocked"
            activeColor="text-warning"
            icon={Shield}
          />
          <StatusChip
            active={contact.isOptedOut}
            label="Opted out"
            activeColor="text-error"
            icon={ShieldOff}
          />
        </div>
      </div>

      {/* ── Tags ── */}
      <div className="border-b border-base-300 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-base-content/40" />
          <span className="op-label">Tags</span>
          {(assignTagsMutation.isPending || removeTagsMutation.isPending) && (
            <span className="loading loading-spinner loading-xs text-primary" />
          )}
        </div>
        <TagsPicker
          tags={tags}
          allTags={allTags}
          onAssign={(tagIds) => assignTagsMutation.mutate(tagIds)}
          onRemove={(tagIds) => removeTagsMutation.mutate(tagIds)}
        />
      </div>

      {/* ── Custom fields ── */}
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-base-content/40" />
          <span className="op-label">Custom fields</span>
        </div>
        <CustomFieldsSection contactId={contact.id} />
      </div>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={deleteConfirm}
        title="Delete contact"
        description={`Soft-delete ${contact.name || contact.phone}? They will be marked as deleted and no longer appear in the contacts list.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
