import { AccessDenied } from "@/components/platform/AccessDenied";
import { FailedSendsClient } from "@/components/platform/FailedSendsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformFailedSendsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Failed sends" />;
  }
  return (
    <>
      <PageHeader title="Failed sends" description="Cross-tenant outbound send failures with Meta error reasons." />
      <FailedSendsClient />
    </>
  );
}
