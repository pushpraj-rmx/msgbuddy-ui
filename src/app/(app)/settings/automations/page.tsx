import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationsClient } from "@/components/automation/AutomationsClient";
import type { MeResponse } from "@/lib/api";
import type { AutomationRule } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function AutomationsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const allowed = roleHasWorkspacePermission(
    String(me.role),
    "automations.manage",
  );

  if (!allowed) {
    return (
      <PageContainer>
        <div className="mb-2">
          <Link href="/settings" className="btn btn-ghost btn-sm gap-1">
            ← Settings
          </Link>
        </div>
        <PageHeader
          title="Inbox automation"
          description="Rules that fire actions in response to inbound messages."
        />
        <p className="text-sm text-base-content/65">
          You don&apos;t have permission to manage automations.
        </p>
      </PageContainer>
    );
  }

  const initial = await serverFetch<AutomationRule[]>(
    endpoints.automation.rules,
  );

  return (
    <PageContainer>
      <div className="mb-2">
        <Link href="/settings" className="btn btn-ghost btn-sm gap-1">
          ← Settings
        </Link>
      </div>
      <PageHeader
        title="Inbox automation"
        description="Rules that fire actions in response to inbound messages. Configure business hours separately to drive out-of-hours rules."
      />
      <AutomationsClient initial={initial} />
    </PageContainer>
  );
}
