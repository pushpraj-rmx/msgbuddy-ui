import { AccessDenied } from "@/components/platform/AccessDenied";
import { PlatformConsoleClient } from "@/components/platform/PlatformConsoleClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Platform" />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Platform"
        description="Platform control plane for cross-workspace operations and read-only inspection."
      />
      <PlatformConsoleClient platformRole={me.platformRole} />
    </PageContainer>
  );
}
