import { notFound } from "next/navigation";
import Link from "next/link";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { ChannelTemplateDetailClient } from "@/components/templates/ChannelTemplateDetailClient";

export default async function ChannelTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let me: MeResponse;
  try {
    me = await serverFetch<MeResponse>(endpoints.auth.me);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp template</h1>
          <p className="text-sm text-base-content/60">
            Manage versions, approval, and activation.
          </p>
        </div>
        <Link href="/templates" className="btn btn-ghost btn-sm">
          Back to messages
        </Link>
      </div>

      <ChannelTemplateDetailClient
        key={me.workspace.id}
        channelTemplateId={id}
        workspaceId={me.workspace.id}
      />
    </div>
  );
}

