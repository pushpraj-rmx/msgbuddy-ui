import { AccessDenied } from "@/components/platform/AccessDenied";
import { ConnectedClientBusinessesTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { isSuperAdmin } from "@/lib/platform-access";

export default async function PlatformClientBusinessesPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!isSuperAdmin(me.platformRole)) {
    return <AccessDenied title="Client businesses" />;
  }
  return (
    <>
      <PageHeader title="Client businesses" description="Meta connected client businesses for the platform app." />
      <ConnectedClientBusinessesTab />
    </>
  );
}
