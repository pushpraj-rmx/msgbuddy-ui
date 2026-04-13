import Link from "next/link";
import { CampaignsAccessDenied } from "@/components/campaigns/CampaignsAccessDenied";
import {
  CreateCampaignForm,
  type CampaignCreateTemplate,
} from "@/components/campaigns/CreateCampaignForm";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCampaigns } from "@/lib/workspace-access";

export default async function CampaignNewPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessCampaigns(String(me.role))) {
    return (
      <PageContainer>
        <div className="mb-2">
          <Link href="/campaigns" className="btn btn-ghost btn-sm gap-1">
            ← Campaigns
          </Link>
        </div>
        <PageHeader
          title="New campaign"
          description="Create an outbound WhatsApp campaign in three steps."
        />
        <CampaignsAccessDenied workspaceName={me.workspace.name} />
      </PageContainer>
    );
  }

  const templatesRes = await serverFetch<{ items: CampaignCreateTemplate[] }>(
    `${endpoints.templates.list}?limit=100&hasWhatsAppSendableVersion=true`
  );
  const templates = templatesRes?.items ?? [];

  return (
    <PageContainer>
      <div className="mb-2">
        <Link href="/campaigns" className="btn btn-ghost btn-sm gap-1">
          ← Campaigns
        </Link>
      </div>
      <PageHeader
        title="New campaign"
        description="Create an outbound WhatsApp campaign in three steps. Set an optional send time on the campaign page."
      />
      <CreateCampaignForm templates={templates} />
    </PageContainer>
  );
}
