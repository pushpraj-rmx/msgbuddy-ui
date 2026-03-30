"use client";

import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { contactsApi, tagsApi } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { ActivityTimeline } from "./ActivityTimeline";
import { ContactFormModal } from "./ContactFormModal";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { NotesSection } from "./NotesSection";
import { TagsPicker } from "./TagsPicker";

const CONTACT_QUERY_KEY = (id: string) => ["contacts", id] as const;
const TAGS_QUERY_KEY = ["tags"] as const;

export function ContactDetailClient({
  initialContact,
  currentUserId,
}: {
  initialContact: Contact;
  currentUserId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "tags" | "notes" | "activity">("details");
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
    refetch();
  };

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name?: string;
      email?: string;
      phoneLabel?: string;
      emailLabel?: string;
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
      if (typeof window !== "undefined") window.location.href = "/contacts";
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/contacts" className="btn btn-ghost btn-sm">
          ← Contacts
        </Link>
      </div>

      <div className="rounded-box border border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              {contact.name || "Unnamed"}
            </h1>
            <p className="text-sm text-base-content/70">
              {contact.phone}
              {contact.phoneLabel && (
                <span className="ml-1 text-base-content/50">
                  ({contact.phoneLabel})
                </span>
              )}
            </p>
            {contact.email && (
              <p className="text-sm text-base-content/70">
                {contact.email}
                {contact.emailLabel && (
                  <span className="ml-1 text-base-content/50">
                    ({contact.emailLabel})
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span>Blocked</span>
              <input
                type="checkbox"
                className="toggle toggle-warning toggle-sm"
                checked={contact.isBlocked}
                onChange={(e) =>
                  consentMutation.mutate({
                    isBlocked: e.target.checked,
                    isOptedOut: contact.isOptedOut,
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>Opted out</span>
              <input
                type="checkbox"
                className="toggle toggle-error toggle-sm"
                checked={contact.isOptedOut}
                onChange={(e) =>
                  consentMutation.mutate({
                    isBlocked: contact.isBlocked,
                    isOptedOut: e.target.checked,
                  })
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={() => setDeleteConfirm(true)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div role="tablist" className="tabs tabs-box bg-base-200 p-1">
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "details" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "tags" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("tags")}
        >
          Tags
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "notes" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "activity" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          Activity
        </button>
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        {activeTab === "details" && (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-base-content/70 mb-2">
                Custom fields
              </h2>
              <CustomFieldsSection contactId={contact.id} />
            </section>
          </div>
        )}
        {activeTab === "tags" && (
          <div>
            <h2 className="text-sm font-semibold text-base-content/70 mb-2">
              Tags
            </h2>
            <TagsPicker
              tags={tags}
              allTags={allTags}
              onAssign={(tagIds) => assignTagsMutation.mutate(tagIds)}
              onRemove={(tagIds) => removeTagsMutation.mutate(tagIds)}
            />
          </div>
        )}
        {activeTab === "notes" && (
          <div>
            <h2 className="text-sm font-semibold text-base-content/70 mb-2">
              Notes
            </h2>
            <NotesSection
              contactId={contact.id}
              currentUserId={currentUserId}
            />
          </div>
        )}
        {activeTab === "activity" && (
          <div>
            <h2 className="text-sm font-semibold text-base-content/70 mb-2">
              Activity
            </h2>
            <ActivityTimeline contactId={contact.id} />
          </div>
        )}
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
              isBlocked: payload.isBlocked,
              isOptedOut: payload.isOptedOut,
            })
          }
        />
      )}

      {deleteConfirm && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Delete contact</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Soft-delete this contact? They will no longer appear in the list.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              onClick={() => setDeleteConfirm(false)}
              aria-label="Close"
            />
          </form>
        </dialog>
      )}
    </div>
  );
}
