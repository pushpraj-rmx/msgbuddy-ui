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

/**
 * "New template" collects a name + WhatsApp category, then creates the draft on
 * submit and drops the user into the editor. Creation is deferred to submit so
 * abandoning the page never leaves an orphan "Untitled template" draft in the
 * list. Message content is still edited inline on the channel-template editor;
 * nothing is sent to Meta until the user submits for approval.
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
  const [category, setCategory] = useState<TemplateCategory>("UTILITY");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const channel = await templatesApi.addWhatsApp(template.id, { category });
      // Raw API (not a mutation hook), so refresh the list/limits ourselves — otherwise the
      // new draft is missing when the user returns to the templates list.
      void queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: templateKeys.limits() });
      router.replace(`/channel-templates/${channel.id}`);
    } catch (err) {
      setSubmitting(false);
      setError(getApiError(err) || "Failed to create template.");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="card border border-base-300 bg-base-100 p-6">
        <h1 className="text-base font-semibold">New template</h1>
        <p className="mt-1 text-[0.8125rem] text-base-content/60">
          Name it and pick a WhatsApp category. You&apos;ll add the message content next.
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

          <label className="block">
            <span className="op-label mb-1 block">Category</span>
            <select
              className="select select-bordered w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-base-content/55">
              {CATEGORY_OPTIONS.find((o) => o.value === category)?.hint}
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
