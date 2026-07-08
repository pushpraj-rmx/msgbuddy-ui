import { AccessDenied } from "@/components/platform/AccessDenied";
import { OpsClient } from "@/components/ops/OpsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformOpsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Ops" />;
  }
  return (
    <>
      <PageHeader title="Ops queues" description="Operational visibility for queues and upload sessions." />
      <OpsClient />
    </>
  );
}
