"use client";

import { useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Contact } from "@/lib/types";

export type ContactFormPayload = {
  phone?: string;
  phoneLabel?: string;
  name?: string;
  email?: string;
  emailLabel?: string;
  isBlocked?: boolean;
  isOptedOut?: boolean;
};

export function ContactFormModal({
  title,
  contact,
  onClose,
  onSave,
}: {
  title: string;
  contact?: Contact;
  onClose: () => void;
  onSave: (payload: ContactFormPayload) => void;
}) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [phoneLabel, setPhoneLabel] = useState(contact?.phoneLabel ?? "");
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [emailLabel, setEmailLabel] = useState(contact?.emailLabel ?? "");
  const [isBlocked, setIsBlocked] = useState(contact?.isBlocked ?? false);
  const [isOptedOut, setIsOptedOut] = useState(contact?.isOptedOut ?? false);

  const handleSave = () => {
    onSave({
      ...(contact ? {} : { phone: phone.trim() }),
      phoneLabel: phoneLabel.trim() || undefined,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      emailLabel: emailLabel.trim() || undefined,
      ...(contact
        ? { isBlocked, isOptedOut }
        : {}),
    });
  };

  const formContent = (
    <>
      <div className="space-y-4">
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

  if (isLg) {
    return (
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-base-300 bg-base-100 shadow-xl lg:w-[400px]"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
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
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-4">{formContent}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
