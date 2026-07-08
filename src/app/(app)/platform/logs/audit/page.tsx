import { AccessDenied } from "@/components/platform/AccessDenied";
import { AuditLogsTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformAuditLogPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Audit log" />;
  }
  return (
    <>
      <PageHeader title="Audit log" description="Platform admin actions (super-admin audit trail)." />
      <AuditLogsTab />
    </>
  );
}
