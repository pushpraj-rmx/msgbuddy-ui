import { AccessDenied } from "@/components/platform/AccessDenied";
import { UsersTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform, isSuperAdmin } from "@/lib/platform-access";

export default async function PlatformUsersPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Users" />;
  }
  return (
    <>
      <PageHeader title="Users" description="Every user account across all workspaces." />
      <UsersTab superAdmin={isSuperAdmin(me.platformRole)} />
    </>
  );
}
