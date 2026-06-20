import { FlowsClient } from "@/components/flows/FlowsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessFlows } from "@/lib/workspace-access";

export default async function FlowsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessFlows(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Flows"
          description="Build visual chatbot flows that reply, branch, and hand off."
        />
        <div
          role="alert"
          className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
        >
          <span className="op-label mb-1 block text-warning">permission denied</span>
          <p className="text-[0.8125rem] text-base-content">
            You don&apos;t have permission to manage flows.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Flows"
        description="Build visual chatbot flows that reply, branch, and hand off to an agent or AI."
      />
      <FlowsClient />
    </PageContainer>
  );
}
