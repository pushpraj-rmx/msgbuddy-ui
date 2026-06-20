"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { templatesApi } from "@/lib/api";
import { templateKeys } from "@/hooks/use-templates";
import { getApiError } from "@/lib/api-error";

/**
 * "New template" creates a DRAFT immediately and drops the user straight into the editor — there
 * is no separate name/description step. Name, description, category, and message content are all
 * edited inline on the channel-template editor. Nothing is sent to Meta until the user submits.
 */
export function CreateTemplateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const template = await templatesApi.create({ name: "Untitled template" });
        const channel = await templatesApi.addWhatsApp(template.id, {
          category: "MARKETING",
        });
        // Raw API (not a mutation hook), so refresh the list/limits ourselves — otherwise the
        // new draft is missing when the user returns to the templates list.
        void queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: templateKeys.limits() });
        router.replace(`/channel-templates/${channel.id}`);
      } catch (err) {
        startedRef.current = false;
        setError(getApiError(err) || "Failed to create template.");
      }
    })();
  }, [router, queryClient]);

  if (error) {
    return (
      <div className="w-full max-w-md">
        <div className="card border border-base-300 bg-base-100 p-6">
          <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem] text-base-content">{error}</p>
          </div>
          <Link
            href="/templates"
            className="btn btn-ghost btn-sm mt-4 gap-1.5 self-start text-base-content/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-base-content/60">
      <span className="loading loading-spinner loading-sm" />
      Creating draft…
    </div>
  );
}
