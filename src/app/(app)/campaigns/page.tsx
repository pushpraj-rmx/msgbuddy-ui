import { CampaignsAccessDenied } from "@/components/campaigns/CampaignsAccessDenied";
import { CampaignsClient, type Campaign } from "@/components/campaigns/CampaignsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCampaigns } from "@/lib/workspace-access";

export default async function CampaignsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessCampaigns(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Campaigns"
          description="Outbound campaigns for this workspace."
        />
        <CampaignsAccessDenied workspaceName={me.workspace.name} />
      </PageContainer>
    );
  }

  const campaigns = await serverFetch<Campaign[]>(endpoints.campaigns.list);

  return (
    <PageContainer>
      <PageHeader
        title="Campaigns"
        description="Create and monitor outbound campaigns."
      />
      <CampaignsClient initialCampaigns={campaigns} />
    </PageContainer>
  );
}
