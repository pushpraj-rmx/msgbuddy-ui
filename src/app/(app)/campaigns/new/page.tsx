import Link from "next/link";
import { CampaignsAccessDenied } from "@/components/campaigns/CampaignsAccessDenied";
import { NewCampaignBootstrap } from "@/components/campaigns/NewCampaignBootstrap";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCampaigns } from "@/lib/workspace-access";

/**
 * Creates a DRAFT campaign on mount and redirects to /campaigns/[id]/edit.
 * The wizard always operates on a known campaign id so every step can persist
 * via PUT — the user can leave + resume any time.
 */
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
          description="Save your draft as you go. Sending only starts after you review and click Start on the campaign page."
        />
        <CampaignsAccessDenied workspaceName={me.workspace.name} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <Link href="/campaigns" className="btn btn-ghost btn-sm gap-1">
          ← Campaigns
        </Link>
      </div>
      <PageHeader
        title="New campaign"
        description="Save your draft as you go. Sending only starts after you review and click Start on the campaign page."
      />
      <NewCampaignBootstrap />
    </PageContainer>
  );
}
