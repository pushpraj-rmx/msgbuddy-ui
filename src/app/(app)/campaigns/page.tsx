import {
  CampaignsClient,
  type Campaign,
  type Template,
} from "@/components/campaigns/CampaignsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function CampaignsPage() {
  const [campaigns, templatesRes] = await Promise.all([
    serverFetch<Campaign[]>(endpoints.campaigns.list),
    serverFetch<{ items: Template[] }>(
      `${endpoints.templates.list}?limit=100`
    ),
  ]);
  const templates = templatesRes?.items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Campaigns"
        description="Create and monitor outbound campaigns."
      />
      <CampaignsClient initialCampaigns={campaigns} templates={templates} />
    </PageContainer>
  );
}
