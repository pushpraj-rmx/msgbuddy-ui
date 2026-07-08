"use client";

import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { contactsApi, tagsApi } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActivityTimeline } from "./ActivityTimeline";
import { ContactFormModal } from "./ContactFormModal";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { NotesSection } from "./NotesSection";
import { MemorySection } from "./MemorySection";
import { InfoTip } from "@/components/ui/InfoTip";
import { TagsPicker } from "./TagsPicker";

const CONTACT_QUERY_KEY = (id: string) => ["contacts", id] as const;
const TAGS_QUERY_KEY = ["tags"] as const;

type TabKey = "details" | "tags" | "notes" | "memory" | "activity";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "details", label: "Details" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "memory", label: "Memory" },
  { key: "activity", label: "Activity" },
];

export function ContactDetailClient({
  initialContact,
  currentUserId,
  meRole,
}: {
  initialContact: Contact;
  currentUserId?: string;
  meRole: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const canEditContact = roleHasWorkspacePermission(meRole, "contacts.create");
  const canDeleteContact = roleHasWorkspacePermission(meRole, "contacts.delete");

  const queryClient = useQueryClient();
  const { data: contact = initialContact, refetch } = useQuery({
    queryKey: CONTACT_QUERY_KEY(initialContact.id),
    queryFn: () =>
      contactsApi.getOne(initialContact.id, {
        include: "tags,customFields",
      }),
    initialData: initialContact,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: () => tagsApi.list(),
  });

  const tags = contact.tags ?? [];

  const invalidateContact = () => {
    queryClient.invalidateQueries({ queryKey: CONTACT_QUERY_KEY(contact.id) });
    // Also refresh the contacts list so edits/tag changes made here are
    // reflected in the list's name/tags columns (the drawer does the same).
    queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
    refetch();
  };

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name?: string;
      email?: string;
      phoneLabel?: string;
      emailLabel?: string;
      designation?: string;
      isBlocked?: boolean;
      isOptedOut?: boolean;
    }) => contactsApi.update(contact.id, payload),
    onSuccess: () => {
      invalidateContact();
      setEditing(false);
    },
  });

  const consentMutation = useMutation({
    mutationFn: (data: { isBlocked?: boolean; isOptedOut?: boolean }) =>
      contactsApi.updateConsent(contact.id, data),
    onSuccess: invalidateContact,
  });

  const assignTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) => contactsApi.assignTags(contact.id, tagIds),
    onSuccess: invalidateContact,
  });

  const removeTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) => contactsApi.removeTags(contact.id, tagIds),
    onSuccess: invalidateContact,
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(contact.id),
    onSuccess: () => {
      if (typeof window !== "undefined")
        window.location.href = "/people/contacts";
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/people/contacts"
          className="font-mono-op text-[0.6875rem] tracking-[0.04em] uppercase text-base-content/55 transition-colors hover:text-primary"
        >
          ← People
        </Link>
      </div>

      {/* Hero card */}
      <div className="op-grain rounded-box border border-base-300 bg-base-200">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <span className="op-label">contact</span>
            <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-0.025em]">
              {contact.name || "Unnamed"}
            </h1>
            <p className="font-mono-op mt-1 text-[0.78125rem] tabular-nums text-base-content/70">
              {contact.phone}
              {contact.phoneLabel && (
                <span className="ml-1.5 font-sans text-base-content/50">
                  · {contact.phoneLabel}
                </span>
              )}
            </p>
            {contact.email && (
              <p className="mt-0.5 text-[0.78125rem] text-base-content/70">
                {contact.email}
                {contact.emailLabel && (
                  <span className="ml-1.5 text-base-content/50">
                    · {contact.emailLabel}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[0.78125rem]">
              <span className="op-label flex items-center gap-1">
                Blocked <InfoTip tip="This contact cannot send messages to your workspace" />
              </span>
              <input
                type="checkbox"
                className="toggle toggle-warning toggle-sm"
                checked={contact.isBlocked}
                disabled={!canEditContact}
                onChange={(e) =>
                  consentMutation.mutate({
                    isBlocked: e.target.checked,
                    isOptedOut: contact.isOptedOut,
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-[0.78125rem]">
              <span className="op-label flex items-center gap-1">
                Opted out <InfoTip tip="Contact requested to stop receiving messages (compliance)" />
              </span>
              <input
                type="checkbox"
                className="toggle toggle-error toggle-sm"
                checked={contact.isOptedOut}
                disabled={!canEditContact}
                onChange={(e) =>
                  consentMutation.mutate({
                    isBlocked: contact.isBlocked,
                    isOptedOut: e.target.checked,
                  })
                }
              />
            </label>
            {canEditContact ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            ) : null}
            {canDeleteContact ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1 text-error/70 hover:text-error"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Operator-style underline tabs */}
      <div className="rounded-box border border-base-300 bg-base-200">
        <div className="flex border-b border-base-300 px-1" role="tablist" aria-label="Contact sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative px-3 py-2.5 text-[0.8125rem] font-medium tracking-tight transition-colors ${
                activeTab === t.key
                  ? "text-primary after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[2px] after:bg-primary"
                  : "text-base-content/55 hover:text-base-content"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === "details" && (
            <section className="space-y-2">
              <h2 className="op-section-title">Custom fields</h2>
              <CustomFieldsSection contactId={contact.id} />
            </section>
          )}
          {activeTab === "tags" && (
            <section className="space-y-2">
              <h2 className="op-section-title">Tags</h2>
              {canEditContact ? (
                <TagsPicker
                  tags={tags}
                  allTags={allTags}
                  onAssign={(tagIds) => assignTagsMutation.mutate(tagIds)}
                  onRemove={(tagIds) => removeTagsMutation.mutate(tagIds)}
                />
              ) : tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="op-tag"
                      style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[0.8125rem] text-base-content/55">No tags assigned.</p>
              )}
            </section>
          )}
          {activeTab === "notes" && (
            <section className="space-y-2">
              <h2 className="op-section-title">Notes</h2>
              <NotesSection
                contactId={contact.id}
                currentUserId={currentUserId}
              />
            </section>
          )}
          {activeTab === "memory" && (
            <section className="space-y-2">
              <h2 className="op-section-title">Memory</h2>
              <MemorySection contactId={contact.id} />
            </section>
          )}
          {activeTab === "activity" && (
            <section className="space-y-2">
              <h2 className="op-section-title">Activity</h2>
              <ActivityTimeline contactId={contact.id} />
            </section>
          )}
        </div>
      </div>

      {editing && (
        <ContactFormModal
          title="Edit contact"
          contact={contact}
          onClose={() => setEditing(false)}
          onSave={(payload) =>
            updateMutation.mutate({
              name: payload.name,
              email: payload.email,
              phoneLabel: payload.phoneLabel,
              emailLabel: payload.emailLabel,
              designation: payload.designation,
              isBlocked: payload.isBlocked,
              isOptedOut: payload.isOptedOut,
            })
          }
        />
      )}

      {canDeleteContact && (
        <ConfirmDialog
          open={deleteConfirm}
          title="Delete contact"
          description="Soft-delete this contact? They will no longer appear in the list."
          confirmLabel="Delete"
          tone="danger"
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
