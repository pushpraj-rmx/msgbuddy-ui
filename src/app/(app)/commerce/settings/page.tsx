import { CommerceSettingsClient } from "@/components/commerce/CommerceSettingsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCommerce } from "@/lib/workspace-access";

export default async function CommerceSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessCommerce(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Commerce settings"
          description="Connect Meta product catalogs to WhatsApp."
        />
        <div
          role="alert"
          className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
        >
          <span className="op-label mb-1 block text-warning">permission denied</span>
          <p className="text-[0.8125rem] text-base-content">
            You don&apos;t have permission to access commerce.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Commerce settings"
        description="Connect a Meta System User token so WhatsApp can access your product catalogs."
      />
      <CommerceSettingsClient meRole={String(me.role)} />
    </PageContainer>
  );
}
