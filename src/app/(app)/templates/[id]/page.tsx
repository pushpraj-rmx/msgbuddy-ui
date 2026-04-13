import { notFound } from "next/navigation";
import { TemplateDetailClient } from "@/components/templates/TemplateDetailClient";
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
      <div>
        <h1 className="text-2xl font-semibold">Message</h1>
        <p className="text-sm text-base-content/60">
          Configure channels and manage channel-specific versions.
        </p>
      </div>
      <TemplateDetailClient
        key={me.workspace.id}
        templateId={id}
        userRole={me.role}
        workspaceId={me.workspace.id}
      />
    </div>
  );
}
