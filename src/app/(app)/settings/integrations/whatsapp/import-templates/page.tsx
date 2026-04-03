import { notFound } from "next/navigation";
import Link from "next/link";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { WhatsAppMetaTemplateImportClient } from "@/components/integrations/WhatsAppMetaTemplateImportClient";

export default async function WhatsAppImportTemplatesPage() {
  let me: MeResponse;
  try {
    me = await serverFetch<MeResponse>(endpoints.auth.me);
  } catch {
    notFound();
  }

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Import templates from Meta"
          description="Pull existing WhatsApp templates from your connected WABA into MsgBuddy."
        />
        <Link href="/settings/integrations/whatsapp" className="btn btn-ghost btn-sm">
          Back
        </Link>
      </div>

      <WhatsAppMetaTemplateImportClient workspaceId={me.workspace.id} />
    </PageContainer>
  );
}

