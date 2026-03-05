import {
  CampaignsClient,
  type Campaign,
  type Template,
} from "@/components/campaigns/CampaignsClient";
import { serverFetch } from "@/lib/api";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="text-sm text-base-content/60">
          Create and monitor outbound campaigns.
        </p>
      </div>
      <CampaignsClient initialCampaigns={campaigns} templates={templates} />
    </div>
  );
}
