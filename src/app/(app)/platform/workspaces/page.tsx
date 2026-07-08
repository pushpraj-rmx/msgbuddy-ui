import { AccessDenied } from "@/components/platform/AccessDenied";
import { WorkspacesTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformWorkspacesPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Workspaces" />;
  }
  return (
    <>
      <PageHeader title="Workspaces" description="Every tenant workspace on the platform." />
      <WorkspacesTab />
    </>
  );
}
