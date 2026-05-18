"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { templatesApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]+$/;
const TEMPLATE_NAME_MAX = 512;

/** Returns null if the name is valid, otherwise a user-facing reason. */
function validateTemplateName(raw: string): string | null {
  const n = raw.trim();
  if (n.length === 0) return null; // empty handled by `canSubmit`; don't show error before typing
  if (n.length > TEMPLATE_NAME_MAX)
    return `Max ${TEMPLATE_NAME_MAX} characters (currently ${n.length}).`;
  if (!TEMPLATE_NAME_PATTERN.test(n))
    return "Use only lowercase letters, digits, and underscores — no spaces, dashes, or capitals.";
  return null;
}

export function CreateTemplateClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const nameError = useMemo(() => validateTemplateName(name), [name]);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && nameError === null && !busy;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const template = await templatesApi.create({ name: trimmed, description: description.trim() || undefined });
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
          <p className="mt-1 text-[0.8125rem] text-base-content/55">
            Name your template. You&apos;ll set up the category, language, and message content next.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem] text-base-content">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-5" onKeyDown={handleKeyDown}>
          <div>
            <label className="op-label mb-1.5 block" htmlFor="tpl-name">Name</label>
            <input
              id="tpl-name"
              type="text"
              className={`input input-bordered w-full ${nameError ? "input-error" : ""}`}
              placeholder="order_confirmation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={nameError ? "true" : "false"}
              aria-describedby="tpl-name-help"
              maxLength={TEMPLATE_NAME_MAX}
            />
            {nameError ? (
              <p id="tpl-name-help" className="mt-1.5 text-[0.75rem] text-error">
                {nameError}
              </p>
            ) : (
              <p id="tpl-name-help" className="mt-1.5 font-mono-op text-[0.6875rem] tracking-wide text-base-content/40">
                Becomes the WhatsApp template name on Meta. Lowercase letters, digits, and underscores only.
              </p>
            )}
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
