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
        <div role="alert" className="alert alert-warning">
          <span>You don&apos;t have permission to view usage.</span>
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
