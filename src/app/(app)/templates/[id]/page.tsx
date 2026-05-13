import { notFound } from "next/navigation";
import { TemplateDetailClient } from "@/components/templates/TemplateDetailClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function TemplateDetailPage({
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
      <PageHeader title="Message" description="Configure channels and manage channel-specific versions." />
      <TemplateDetailClient
        key={me.workspace.id}
        templateId={id}
        userRole={me.role}
        workspaceId={me.workspace.id}
      />
    </div>
  );
}
