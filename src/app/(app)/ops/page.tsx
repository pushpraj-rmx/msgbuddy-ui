import { OpsClient } from "@/components/ops/OpsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/platform/AccessDenied";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function OpsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Ops" />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Ops"
        description="Operational visibility for queues and upload sessions."
      />
      <OpsClient />
    </PageContainer>
  );
}
