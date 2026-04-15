import { BillingClient } from "@/components/billing/BillingClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessBillingPage } from "@/lib/workspace-access";

export default async function BillingPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessBillingPage(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Billing"
          description="Manage your subscription and plan."
        />
        <div role="alert" className="alert alert-warning">
          <span>You don&apos;t have permission to view billing.</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Billing"
        description="Manage your subscription and plan."
      />
      <BillingClient workspaceId={me.workspace.id} />
    </PageContainer>
  );
}
