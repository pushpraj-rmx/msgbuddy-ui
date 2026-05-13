import { AccessDenied } from "@/components/platform/AccessDenied";
import { OnboardingWabaClient } from "@/components/platform/OnboardingWabaClient";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Discover owned and client-shared WABAs before workspace-level setup." />
      <OnboardingWabaClient />
    </div>
  );
}
