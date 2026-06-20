import { TemplatesClient } from "@/components/templates/TemplatesClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canViewTemplates } from "@/lib/workspace-access";

export default async function TemplatesPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canViewTemplates(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Templates"
          description="Create and manage message templates."
        />
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span>You don&apos;t have permission to view templates.</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Templates"
        description="Create and manage message templates. Search, filter, sort, and preview on demand."
      />
      <TemplatesClient meRole={String(me.role)} />
    </PageContainer>
  );
}
