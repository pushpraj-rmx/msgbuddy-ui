import { AccessDenied } from "@/components/platform/AccessDenied";
import { ChannelAccountsTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { isSuperAdmin } from "@/lib/platform-access";

export default async function PlatformChannelsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!isSuperAdmin(me.platformRole)) {
    return <AccessDenied title="Channel accounts" />;
  }
  return (
    <>
      <PageHeader title="Channel accounts" description="Global pool of channel accounts and workspace assignments." />
      <ChannelAccountsTab />
    </>
  );
}
