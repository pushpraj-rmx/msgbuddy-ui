import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { DisplayPreferencesClient } from "@/components/settings/DisplayPreferencesClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function AppearanceSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  return (
    <PageContainer>
      <PageHeader
        title="Appearance"
        description="Control display density. Switch themes from the palette button in the top bar."
      />
      <section className="space-y-3">
        <span className="op-section-title">Display</span>
        <DisplayPreferencesClient initialDensity={me.user.displayDensity ?? "MEDIUM"} />
      </section>
    </PageContainer>
  );
}
