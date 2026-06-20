"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { templatesApi, channelTemplatesApi } from "@/lib/api";
import type { TemplateCategory } from "@/lib/types";
import { getApiError } from "@/lib/api-error";

const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]+$/;
const TEMPLATE_NAME_MAX = 512;
const BODY_MAX = 1024;

const CATEGORIES: { value: TemplateCategory; label: string; hint: string }[] = [
  { value: "MARKETING", label: "Marketing", hint: "Promotions, offers, and announcements." },
  { value: "UTILITY", label: "Utility", hint: "Updates tied to a transaction (orders, accounts)." },
  { value: "AUTHENTICATION", label: "Authentication", hint: "One-time passcodes." },
];

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
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [body, setBody] = useState("");

  const nameError = useMemo(() => validateTemplateName(name), [name]);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && nameError === null && !busy;

  const categoryHint = CATEGORIES.find((c) => c.value === category)?.hint;

  // Creates a LOCAL DRAFT only — `addWhatsApp` seeds version 1 with status DRAFT and saving the
  // body keeps it DRAFT. Nothing is sent to Meta until the user submits from the editor.
  const handleCreate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const template = await templatesApi.create({
        name: trimmed,
        description: description.trim() || undefined,
      });
      const channel = await templatesApi.addWhatsApp(template.id, { category });
      const bodyTrimmed = body.trim();
      if (bodyTrimmed) {
        await channelTemplatesApi.updateVersion(channel.id, 1, { body: bodyTrimmed });
      }
      router.push(`/channel-templates/${channel.id}`);
    } catch (err) {
      setError(getApiError(err) || "Failed to create template.");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="card border border-base-300 bg-base-100 p-6">
        <header className="mb-6">
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Create template</h2>
          <p className="mt-1 text-[0.8125rem] text-base-content/55">
            Saved as a <span className="font-medium">draft</span> — nothing is sent to WhatsApp
            until you submit it for approval. Add a header, buttons, or media on the next screen.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem] text-base-content">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-5">
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

          <div>
            <label className="op-label mb-1.5 block" htmlFor="tpl-category">Category</label>
            <select
              id="tpl-category"
              className="select select-bordered w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[0.6875rem] text-base-content/40">{categoryHint}</p>
          </div>

          <div>
            <label className="op-label mb-1.5 block" htmlFor="tpl-body">Message</label>
            <textarea
              id="tpl-body"
              className="textarea textarea-bordered min-h-[7rem] w-full"
              placeholder="Hi {{1}}, your order is confirmed and on its way."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={BODY_MAX}
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-[0.6875rem] text-base-content/40">
                Use {"{{1}}"}, {"{{2}}"}… for variables. Optional now — you can write it on the next screen.
              </p>
              <span className="shrink-0 font-mono-op text-[0.6875rem] text-base-content/40">
                {body.length}/{BODY_MAX}
              </span>
            </div>
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
              "Create draft"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
