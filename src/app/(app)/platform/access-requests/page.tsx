import { AccessDenied } from "@/components/platform/AccessDenied";
import { AccessRequestsTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformAccessRequestsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Access requests" />;
  }
  return (
    <>
      <PageHeader title="Access requests" description="Account-recovery and help requests queue." />
      <AccessRequestsTab />
    </>
  );
}
