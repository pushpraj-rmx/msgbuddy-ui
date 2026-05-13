"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { contactsApi } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { AvatarCropUpload } from "@/components/ui/AvatarCropUpload";

export type ContactFormPayload = {
  phone?: string;
  phoneLabel?: string;
  name?: string;
  designation?: string;
  email?: string;
  emailLabel?: string;
  isBlocked?: boolean;
  isOptedOut?: boolean;
  avatarUrl?: string;
};

export function ContactFormModal({
  title,
  contact,
  onClose,
  onSave,
  onViewExisting,
}: {
  title: string;
  contact?: Contact;
  onClose: () => void;
  onSave: (payload: ContactFormPayload) => void;
  onViewExisting?: (contactId: string) => void;
}) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: delay render until media query resolves to prevent dialog flash
  useEffect(() => { setMounted(true); }, []);
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [phoneLabel, setPhoneLabel] = useState(contact?.phoneLabel ?? "");
  const [name, setName] = useState(contact?.name ?? "");
  const [designation, setDesignation] = useState(contact?.designation ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [emailLabel, setEmailLabel] = useState(contact?.emailLabel ?? "");
  const [isBlocked, setIsBlocked] = useState(contact?.isBlocked ?? false);
  const [isOptedOut, setIsOptedOut] = useState(contact?.isOptedOut ?? false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    contact?.avatarUrl ?? undefined
  );

  const debouncedPhone = useDebouncedValue(phone, 500);
  const phoneCheck = useQuery({
    queryKey: ["contacts", "check-phone", debouncedPhone],
    queryFn: () => contactsApi.checkPhone(debouncedPhone.trim()),
    enabled: !contact && debouncedPhone.trim().length >= 7,
    staleTime: 30_000,
  });

  const handleSave = () => {
    onSave({
      ...(contact ? {} : { phone: phone.trim() }),
      phoneLabel: phoneLabel.trim() || undefined,
      name: name.trim() || undefined,
      designation: designation.trim() || undefined,
      email: email.trim() || undefined,
      emailLabel: emailLabel.trim() || undefined,
      ...(contact ? { isBlocked, isOptedOut } : {}),
      avatarUrl,
    });
  };

  const initials = name.trim()
    ? name.trim().slice(0, 2).toUpperCase()
    : (contact?.phone ?? phone).slice(-2);

  const formContent = (
    <>
      <div className="space-y-4">
        {/* Avatar — only shown when editing an existing contact */}
        {contact && (
          <div className="space-y-1">
            <label className="label-text text-sm font-medium">Photo</label>
            <AvatarCropUpload
              currentUrl={avatarUrl}
              initials={initials}
              onUploaded={setAvatarUrl}
              size="md"
            />
          </div>
        )}

        {!contact ? (
          <>
            <label className="label">
              <span className="label-text">Phone</span>
            </label>
            <input
              type="tel"
              placeholder="+14155552671"
              className="input input-bordered w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {phoneCheck.data?.exists && phoneCheck.data.contact && (
              <div className="mt-1 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-[12.5px]">
                <span className="op-label mb-1 block text-warning">duplicate phone</span>
                <span className="text-base-content">
                  A contact with this phone already exists
                  {phoneCheck.data.contact.name ? `: ${phoneCheck.data.contact.name}` : ""}
                  {" "}({phoneCheck.data.contact.phone})
                </span>
                {onViewExisting && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => onViewExisting(phoneCheck.data.contact!.id)}
                  >
                    View
                  </button>
                )}
              </div>
            )}
            <label className="label">
              <span className="label-text">Phone label (optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Work, Personal"
              className="input input-bordered w-full"
              value={phoneLabel}
              onChange={(e) => setPhoneLabel(e.target.value)}
            />
          </>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="label">
                <span className="label-text">Phone</span>
              </label>
              <p className="text-base-content/80">{contact.phone}</p>
            </div>
            <div>
              <label className="label">
                <span className="label-text">Phone label (optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Work, Personal"
                className="input input-bordered w-full"
                value={phoneLabel}
                onChange={(e) => setPhoneLabel(e.target.value)}
              />
            </div>
          </div>
        )}
        <label className="label">
          <span className="label-text">Name</span>
        </label>
        <input
          type="text"
          placeholder="Name"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="label">
          <span className="label-text">Designation (optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Senior Engineer, CEO"
          className="input input-bordered w-full"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
        />
        <label className="label">
          <span className="label-text">Email</span>
        </label>
        <input
          type="email"
          placeholder="Email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="label">
          <span className="label-text">Email label (optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Work, Personal"
          className="input input-bordered w-full"
          value={emailLabel}
          onChange={(e) => setEmailLabel(e.target.value)}
        />
        {contact && (
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-warning checkbox-sm"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
              />
              <span className="label-text">Blocked</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-error checkbox-sm"
                checked={isOptedOut}
                onChange={(e) => setIsOptedOut(e.target.checked)}
              />
              <span className="label-text">Opted out</span>
            </label>
          </div>
        )}
      </div>
      <div className="modal-action mt-4">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!contact && !phone.trim()}
        >
          Save
        </button>
      </div>
    </>
  );

  // Wait for hydration so isLg resolves correctly — prevents dialog→aside flash
  if (!mounted) return null;

  if (isLg) {
    return (
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-base-300 bg-base-100 shadow-lg lg:w-[400px]"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{formContent}</div>
      </aside>
    );
  }

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-md rounded-box">
        <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h3>
        <div className="mt-4">{formContent}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
