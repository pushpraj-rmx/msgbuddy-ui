"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getApiError } from "@/lib/api-error";
import { contactsApi, tagsApi } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
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
          className="fixed inset-0 z-40 bg-black/20"
          aria-hidden
          onClick={onClose}
        />
      ) : null}
      <aside
        className={
          inline
            ? "sticky top-0 flex h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
            : "fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden rounded-box border-l border-base-300 bg-base-100 shadow-xl sm:w-[400px]"
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
          <div className="flex-1 overflow-y-auto p-4">
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
  /** Called after a successful soft-delete so the parent can close the panel. */
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <ContactAvatar
          name={contact.name}
          phone={contact.phone}
          avatarUrl={contact.avatarUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{contact.name || "Unnamed"}</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onEdit(contact)}
                >
                  Edit contact
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteConfirm(true);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
          {deleteError ? (
            <p className="text-sm text-error" role="alert">
              {deleteError}
            </p>
          ) : null}
          {contact.email && (
            <p className="mt-0.5 text-sm text-base-content/70">
              {contact.email}
              {contact.emailLabel && (
                <span className="ml-1 text-base-content/50">
                  ({contact.emailLabel})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-base-content/70 mb-2">Tags</h3>
        <TagsPicker
          tags={tags}
          allTags={allTags}
          onAssign={(tagIds) => assignTagsMutation.mutate(tagIds)}
          onRemove={(tagIds) => removeTagsMutation.mutate(tagIds)}
        />
        {(assignTagsMutation.isPending || removeTagsMutation.isPending) && (
          <span className="loading loading-spinner loading-sm mt-1" />
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-base-content/70 mb-2">
          Custom fields
        </h3>
        <CustomFieldsSection contactId={contact.id} />
      </section>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-base-content/60">Phone</span>
          <span>
            {contact.phone}
            {contact.phoneLabel && (
              <span className="ml-1 text-base-content/50">
                ({contact.phoneLabel})
              </span>
            )}
          </span>
        </div>
        {contact.email && (
          <div className="flex items-center gap-2">
            <span className="text-base-content/60">Email</span>
            <a href={`mailto:${contact.email}`} className="link link-hover">
              {contact.email}
            </a>
            {contact.emailLabel && (
              <span className="text-base-content/50">
                ({contact.emailLabel})
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-base-content/60">Blocked</span>
          <span>{contact.isBlocked ? "Yes" : "No"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base-content/60">Opted out</span>
          <span>{contact.isOptedOut ? "Yes" : "No"}</span>
        </div>
      </div>

      {canDelete && deleteConfirm ? (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Delete contact</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Delete {contact.name || contact.phone}? This soft-deletes the
              contact; they will be marked as deleted and no longer appear in
              this list.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
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
      ) : null}
    </div>
  );
}
