import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignsAccessDenied } from "@/components/campaigns/CampaignsAccessDenied";
import {
  CreateCampaignForm,
  type CampaignCreateTemplate,
  type CampaignDraftSeed,
} from "@/components/campaigns/CreateCampaignForm";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCampaigns } from "@/lib/workspace-access";

/**
 * Resumes a DRAFT campaign in the wizard. Server-fetches the campaign so the
 * wizard hydrates without a client-side loading flash. If the campaign is no
 * longer DRAFT (already started, completed, cancelled), we redirect to the
 * read-only detail view where Start / Pause / Cancel live.
 */
export default async function CampaignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
          title="Edit campaign"
          description="Save your draft as you go."
        />
        <CampaignsAccessDenied workspaceName={me.workspace.name} />
      </PageContainer>
    );
  }

  const campaign = await serverFetch<CampaignDraftSeed & { status: string }>(
    endpoints.campaigns.byId(id),
  );

  // Lock: only DRAFT campaigns are editable in the wizard. SCHEDULED, ACTIVE,
  // COMPLETED, PAUSED, CANCELLED all redirect to the detail page where the
  // appropriate read-only / lifecycle actions live.
  if (campaign.status !== "DRAFT") {
    redirect(`/campaigns?id=${encodeURIComponent(id)}`);
  }

  const templatesRes = await serverFetch<{ items: CampaignCreateTemplate[] }>(
    `${endpoints.templates.list}?limit=100&hasWhatsAppSendableVersion=true`,
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
        title="Edit campaign"
        description="Save your draft as you go. Sending only starts after you review and click Start on the campaign page."
      />
      <CreateCampaignForm
        templates={templates}
        campaignId={id}
        initialCampaign={campaign}
      />
    </PageContainer>
  );
}
