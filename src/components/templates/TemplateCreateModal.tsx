"use client";

import { useState } from "react";
import type { TemplateChannel, TemplateCategory } from "@/lib/types";

type Props = {
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description?: string;
    channel: TemplateChannel;
    category: TemplateCategory;
  }) => void;
  isPending?: boolean;
};

export function TemplateCreateModal({
  onClose,
  onSave,
  isPending = false,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] =
    useState<TemplateChannel>("WHATSAPP");
  const [category, setCategory] =
    useState<TemplateCategory>("UTILITY");

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box">
        <h3 className="text-lg font-semibold">Create template</h3>
        <div className="mt-4 space-y-3">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            placeholder="Template name"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="label">
            <span className="label-text">Description (optional)</span>
          </label>
          <input
            type="text"
            placeholder="Description"
            className="input input-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="label">
            <span className="label-text">Channel</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={channel}
            onChange={(e) =>
              setChannel(e.target.value as TemplateChannel)
            }
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="MSGBUDDY">MsgBuddy</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>
          <label className="label">
            <span className="label-text">Category</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as TemplateCategory)
            }
          >
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim() || undefined,
                channel,
                category,
              })
            }
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
