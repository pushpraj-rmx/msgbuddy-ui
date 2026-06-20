import { notFound } from "next/navigation";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { ChannelTemplateDetailClient } from "@/components/templates/ChannelTemplateDetailClient";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader
        title="WhatsApp template"
        description="Manage versions, approval, and activation."
      />

      <ChannelTemplateDetailClient
        key={me.workspace.id}
        channelTemplateId={id}
        workspaceId={me.workspace.id}
      />
    </div>
  );
}

