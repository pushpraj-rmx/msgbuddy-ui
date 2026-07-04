"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { templatesApi } from "@/lib/api";
import { templateKeys } from "@/hooks/use-templates";
import { getApiError } from "@/lib/api-error";
import type { TemplateCategory } from "@/lib/types";
import { LanguageCombobox } from "@/components/templates/LanguageCombobox";
import {
  DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE,
  WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS,
} from "@/lib/whatsapp-template-languages";

/**
 * "New template" collects a name, a template type, a WhatsApp category and a
 * language, then creates the draft on submit and drops the user into the
 * editor. Creation is deferred to submit so abandoning the page never leaves an
 * orphan "Untitled template" draft in the list. The chosen type + language are
 * threaded to the editor via `?type=&lang=` query params, which the detail
 * screen reads to seed the very first version's create payload. Message content
 * is still edited inline on the channel-template editor; nothing is sent to Meta
 * until the user submits for approval.
 */
/** Mirror of the backend `sanitizeMetaTemplateName` so users see the name they'll register. */
function sanitizeMetaName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "template"
  );
}

/** Template-type presets. `category`, when set, is required by the shape and locks the picker. */
type TemplatePreset =
  | "standard"
  | "media"
  | "coupon"
  | "lto"
  | "carousel"
  | "authentication"
  | "catalog"
  | "flow";

const TEMPLATE_TYPE_PRESETS: {
  value: TemplatePreset;
  label: string;
  description: string;
  category?: TemplateCategory;
}[] = [
  { value: "standard", label: "Standard (text)", description: "Header optional, body, buttons." },
  { value: "media", label: "Media", description: "Image / video / document header + body." },
  { value: "coupon", label: "Coupon", description: "Body + copy-code button.", category: "MARKETING" },
  {
    value: "lto",
    label: "Limited-time offer",
    description: "Countdown offer + copy-code / URL.",
    category: "MARKETING",
  },
  { value: "carousel", label: "Carousel", description: "2–10 media cards.", category: "MARKETING" },
  {
    value: "authentication",
    label: "Authentication (OTP)",
    description: "Meta-generated body + OTP button.",
    category: "AUTHENTICATION",
  },
  { value: "catalog", label: "Catalog", description: "“View catalog” button.", category: "MARKETING" },
  { value: "flow", label: "Flow", description: "Opens a WhatsApp Flow." },
];

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string; hint: string }[] = [
  {
    value: "UTILITY",
    label: "Utility",
    hint: "Order updates, reminders, account alerts. Fastest Meta approval.",
  },
  {
    value: "MARKETING",
    label: "Marketing",
    hint: "Promotions and offers. Subject to the 24h re-marketing rule.",
  },
  {
    value: "AUTHENTICATION",
    label: "Authentication",
    hint: "One-time passcodes. Fixed Meta-generated shape.",
  },
];

export function CreateTemplateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<TemplatePreset>("standard");
  const [category, setCategory] = useState<TemplateCategory>("UTILITY");
  const [language, setLanguage] = useState(DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPreset = TEMPLATE_TYPE_PRESETS.find((p) => p.value === preset);
  // Presets that map to a fixed Meta category own the category — lock the picker.
  const lockedCategory = selectedPreset?.category;
  const effectiveCategory = lockedCategory ?? category;

  const onSelectPreset = (p: (typeof TEMPLATE_TYPE_PRESETS)[number]) => {
    setPreset(p.value);
    // Auto-set the category for presets that require a specific one.
    if (p.category) setCategory(p.category);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the template a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const template = await templatesApi.create({ name: trimmed });
      const channel = await templatesApi.addWhatsApp(template.id, {
        category: effectiveCategory,
      });
      // Raw API (not a mutation hook), so refresh the list/limits ourselves — otherwise the
      // new draft is missing when the user returns to the templates list.
      void queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: templateKeys.limits() });
      // Thread the chosen preset + language so the editor seeds the first version.
      const params = new URLSearchParams({ type: preset, lang: language });
      router.replace(`/channel-templates/${channel.id}?${params.toString()}`);
    } catch (err) {
      setSubmitting(false);
      setError(getApiError(err) || "Failed to create template.");
    }
  };

  return (
    <div className="w-full max-w-xl">
      <div className="card border border-base-300 bg-base-100 p-6">
        <h1 className="text-base font-semibold">New template</h1>
        <p className="mt-1 text-[0.8125rem] text-base-content/60">
          Name it, pick a type and a WhatsApp category. You&apos;ll add the message content next.
        </p>

        {error && (
          <div className="mt-4 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem] text-base-content">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="op-label mb-1 block">Name</span>
            <input
              autoFocus
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order shipped"
              maxLength={512}
            />
            {name.trim() && (
              <p className="mt-1 text-xs text-base-content/55">
                Registered with Meta as{" "}
                <span className="font-mono-op">{sanitizeMetaName(name)}</span>
              </p>
            )}
          </label>

          <div className="block">
            <span className="op-label mb-1 block">Type</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEMPLATE_TYPE_PRESETS.map((p) => {
                const active = p.value === preset;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onSelectPreset(p)}
                    className={`rounded-box border p-3 text-left transition-colors ${
                      active
                        ? "border-primary border-l-2 bg-primary/5"
                        : "border-base-300 hover:border-base-content/20"
                    }`}
                    aria-pressed={active}
                  >
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="mt-0.5 text-xs text-base-content/55">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="op-label mb-1 block">Category</span>
            <select
              className="select select-bordered w-full"
              value={effectiveCategory}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              disabled={!!lockedCategory}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-base-content/55">
              {lockedCategory
                ? `${selectedPreset?.label} templates must be ${CATEGORY_OPTIONS.find((o) => o.value === lockedCategory)?.label}.`
                : CATEGORY_OPTIONS.find((o) => o.value === effectiveCategory)?.hint}
            </p>
          </label>

          <label className="block">
            <span className="op-label mb-1 block">Language</span>
            <LanguageCombobox
              value={language}
              options={[...WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS]}
              onChange={setLanguage}
            />
            <p className="mt-1 text-xs text-base-content/55">
              The locale registered with Meta for this template&apos;s first version.
            </p>
          </label>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/templates"
              className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !name.trim()}
            >
              {submitting ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Creating…
                </>
              ) : (
                "Create & edit"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
