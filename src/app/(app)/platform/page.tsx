import { AccessDenied } from "@/components/platform/AccessDenied";
import { PlatformConsoleClient } from "@/components/platform/PlatformConsoleClient";
import { serverFetch, type MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Platform" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Platform</h1>
        <p className="text-sm text-base-content/60">
          Platform control plane for cross-workspace operations and read-only
          inspection.
        </p>
      </div>
      <PlatformConsoleClient platformRole={me.platformRole} />
    </div>
  );
}
