import { ChangePasswordClient } from "@/components/settings/ChangePasswordClient";
import { SetPasswordClient } from "@/components/settings/SetPasswordClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function PasswordSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const hasPassword = me.user.hasPassword === true;

  return (
    <PageContainer>
      <PageHeader
        title={hasPassword ? "Change password" : "Set password"}
        description={
          hasPassword
            ? "Use a strong password you do not reuse on other sites."
            : "Add a password so you can sign in with email and password as well as Google."
        }
      />
      {hasPassword ? <ChangePasswordClient /> : <SetPasswordClient />}
    </PageContainer>
  );
}
