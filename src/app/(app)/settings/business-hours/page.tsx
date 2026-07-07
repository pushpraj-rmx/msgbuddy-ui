import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { BusinessHoursForm } from "@/components/automation/BusinessHoursForm";
import type { MeResponse } from "@/lib/api";
import type { BusinessHoursConfig } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function BusinessHoursPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const allowed = roleHasWorkspacePermission(
    String(me.role),
    "automations.manage",
  );

  if (!allowed) {
    return (
      <PageContainer>
        <PageHeader
          title="Business hours"
          description="Configure when your workspace is open. Out-of-hours automation rules fire only when the schedule is set and active."
        />
        <p className="text-sm text-base-content/65">
          You don&apos;t have permission to manage automations.
        </p>
      </PageContainer>
    );
  }

  const initial = await serverFetch<BusinessHoursConfig>(
    endpoints.automation.businessHours,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Business hours"
        description="Configure when your workspace is open. Out-of-hours automation rules fire only when the schedule is set and active."
      />
      <BusinessHoursForm initial={initial} />
    </PageContainer>
  );
}
