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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="op-label block">{label}</span>
      {children}
      {hint ? <p className="text-[0.6875rem] text-base-content/50">{hint}</p> : null}
    </div>
  );
}

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
    <div className="space-y-4">
      {/* Avatar — only when editing */}
      {contact && (
        <Field label="Photo">
          <AvatarCropUpload
            currentUrl={avatarUrl}
            initials={initials}
            onUploaded={setAvatarUrl}
            size="md"
          />
        </Field>
      )}

      {!contact ? (
        <>
          <Field label="Phone">
            <input
              type="tel"
              placeholder="+14155552671"
              className="input input-bordered input-sm font-mono-op w-full tabular-nums"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          {phoneCheck.data?.exists && phoneCheck.data.contact && (
            <div className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2.5">
              <span className="op-label mb-1 block text-warning">duplicate phone</span>
              <p className="text-[0.8125rem] text-base-content">
                A contact with this phone already exists
                {phoneCheck.data.contact.name ? `: ${phoneCheck.data.contact.name}` : ""}
                {" "}
                <span className="font-mono-op tabular-nums text-base-content/70">({phoneCheck.data.contact.phone})</span>
              </p>
              {onViewExisting && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mt-1.5"
                  onClick={() => onViewExisting(phoneCheck.data.contact!.id)}
                >
                  View existing
                </button>
              )}
            </div>
          )}
          <Field label="Phone label" hint="e.g. Work, Personal">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={phoneLabel}
              onChange={(e) => setPhoneLabel(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Phone">
            <p className="font-mono-op text-[0.8125rem] tabular-nums text-base-content/85">{contact.phone}</p>
          </Field>
          <Field label="Phone label" hint="e.g. Work, Personal">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={phoneLabel}
              onChange={(e) => setPhoneLabel(e.target.value)}
            />
          </Field>
        </>
      )}

      <Field label="Name">
        <input
          type="text"
          placeholder="Name"
          className="input input-bordered input-sm w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Designation" hint="e.g. Senior Engineer, CEO">
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          placeholder="name@example.com"
          className="input input-bordered input-sm w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Email label" hint="e.g. Work, Personal">
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          value={emailLabel}
          onChange={(e) => setEmailLabel(e.target.value)}
        />
      </Field>

      {contact && (
        <div className="rounded-box border border-base-300 bg-base-200 px-3 py-3">
          <span className="op-label mb-2 block">Consent</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                className="checkbox checkbox-warning checkbox-sm"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
              />
              <span>Blocked</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                className="checkbox checkbox-error checkbox-sm"
                checked={isOptedOut}
                onChange={(e) => setIsOptedOut(e.target.checked)}
              />
              <span>Opted out</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );

  const actions = (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={handleSave}
        disabled={!contact && !phone.trim()}
      >
        Save
      </button>
    </div>
  );

  // Wait for hydration so isLg resolves correctly
  if (!mounted) return null;

  if (isLg) {
    return (
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-base-300 bg-base-100 lg:w-[400px]"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
          <div>
            <span className="op-label">contact</span>
            <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">{title}</h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{formContent}</div>
        <div className="border-t border-base-300 px-5 py-3">{actions}</div>
      </aside>
    );
  }

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-md rounded-box border border-base-300 !bg-base-100 p-0">
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
          <div>
            <span className="op-label">contact</span>
            <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">{title}</h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{formContent}</div>
        <div className="border-t border-base-300 px-5 py-3">{actions}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
