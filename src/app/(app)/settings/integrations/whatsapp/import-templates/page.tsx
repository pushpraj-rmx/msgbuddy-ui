import { notFound } from "next/navigation";
import Link from "next/link";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { WhatsAppMetaTemplateImportClient } from "@/components/integrations/WhatsAppMetaTemplateImportClient";

export default async function WhatsAppImportTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  let me: MeResponse;
  try {
    me = await serverFetch<MeResponse>(endpoints.auth.me);
  } catch {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const returnToParam = resolvedSearchParams?.returnTo;
  const backHref =
    typeof returnToParam === "string" && returnToParam.startsWith("/")
      ? returnToParam
      : "/templates";

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Import templates from Meta"
          description="Pull existing WhatsApp templates from your connected WABA into MsgBuddy."
        />
        <Link href={backHref} className="btn btn-ghost btn-sm">
          Back
        </Link>
      </div>

      <WhatsAppMetaTemplateImportClient
        key={me.workspace.id}
        workspaceId={me.workspace.id}
      />
    </PageContainer>
  );
}

