import { AccessDenied } from "@/components/platform/AccessDenied";
import { UsageEventsTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformUsageEventsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Usage events" />;
  }
  return (
    <>
      <PageHeader title="Usage events" description="Metered usage events across all workspaces." />
      <UsageEventsTab />
    </>
  );
}
