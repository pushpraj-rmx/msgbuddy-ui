import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountSecurityClient } from "@/components/settings/AccountSecurityClient";
import type { LoginHistoryEvent, MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function AccountSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const loginHistory = await serverFetch<LoginHistoryEvent[]>(
    `${endpoints.auth.loginHistory}?limit=50`
  ).catch(() => [] as LoginHistoryEvent[]);

  return (
    <PageContainer>
      <PageHeader
        title="Profile & security"
        description="Manage your name, avatar, password, and recent sign-in activity."
      />
      <AccountSecurityClient
        accountEmail={me.user.email}
        accountName={me.user.name}
        accountAvatarUrl={me.user.avatarUrl}
        hasPassword={me.user.hasPassword === true}
        loginHistory={loginHistory}
      />
    </PageContainer>
  );
}
