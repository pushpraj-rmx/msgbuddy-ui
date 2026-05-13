"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { templatesApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

export function CreateTemplateClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = name.trim().length > 0 && !busy;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const template = await templatesApi.create({ name: name.trim(), description: description.trim() || undefined });
      const channel = await templatesApi.addWhatsApp(template.id);
      router.push(`/channel-templates/${channel.id}`);
    } catch (err) {
      setError(getApiError(err) || "Failed to create template.");
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      void handleCreate();
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="card border border-base-300 bg-base-100 p-6">
        <header className="mb-6">
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Create template</h2>
          <p className="mt-1 text-[13px] text-base-content/55">
            Name your template. You'll set up the category, language, and message content next.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[13px] text-base-content">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-5" onKeyDown={handleKeyDown}>
          <div>
            <label className="op-label mb-1.5 block" htmlFor="tpl-name">Name</label>
            <input
              id="tpl-name"
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g. Order confirmation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="mt-1.5 font-mono-op text-[11px] tracking-wide text-base-content/40">
              This becomes the WhatsApp template name on Meta.
            </p>
          </div>
          <div>
            <label className="op-label mb-1.5 block" htmlFor="tpl-desc">Description</label>
            <input
              id="tpl-desc"
              type="text"
              className="input input-bordered w-full"
              placeholder="Optional — internal reference only"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/templates"
            className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
          >
            {busy ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
