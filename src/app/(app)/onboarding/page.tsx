import { AccessDenied } from "@/components/platform/AccessDenied";
import { OnboardingWabaClient } from "@/components/platform/OnboardingWabaClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { isSuperAdmin } from "@/lib/platform-access";

export default async function OnboardingPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!isSuperAdmin(me.platformRole)) {
    return <AccessDenied title="Onboarding" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <p className="text-sm text-base-content/60">
          Discover owned and client-shared WABAs before workspace-level setup.
        </p>
      </div>
      <OnboardingWabaClient />
    </div>
  );
}
