import { UsageClient } from "@/components/usage/UsageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessUsagePage } from "@/lib/workspace-access";

export default async function UsagePage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessUsagePage(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Usage"
          description="Track workspace usage, limits, and storage."
        />
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-warning">permission denied</span>
          <p className="text-[0.8125rem] text-base-content">You don&apos;t have permission to view usage.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Usage"
        description="Track workspace usage, limits, and storage."
      />
      <UsageClient />
    </PageContainer>
  );
}
