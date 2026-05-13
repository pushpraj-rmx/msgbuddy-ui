import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessAnalyticsNav } from "@/lib/workspace-access";

export default async function AnalyticsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessAnalyticsNav(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Analytics"
          description="Track delivery, engagement, and channel performance."
        />
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-warning">permission denied</span>
          <p className="text-[13px] text-base-content">You don&apos;t have permission to view analytics.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Track delivery, engagement, and channel performance."
      />
      <AnalyticsClient />
    </PageContainer>
  );
}
