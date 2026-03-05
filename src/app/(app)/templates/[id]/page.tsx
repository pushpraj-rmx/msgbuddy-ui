import { notFound } from "next/navigation";
import { TemplateDetailClient } from "@/components/templates/TemplateDetailClient";
import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { MeResponse } from "@/lib/api";

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
        <h1 className="text-2xl font-semibold">Template</h1>
        <p className="text-sm text-base-content/60">
          Manage versions, submit for approval, and sync to provider.
        </p>
      </div>
      <TemplateDetailClient templateId={id} userRole={me.role} />
    </div>
  );
}
