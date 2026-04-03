"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
}: {
  contactId: string;
  initialContact?: Contact | null;
  onEdit: (contact: Contact) => void;
}) {
  const queryClient = useQueryClient();
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
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onEdit(contact)}
            >
              Edit contact
            </button>
          </div>
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
    </div>
  );
}
