import { redirect } from "next/navigation";
import { ProductsClient } from "@/components/commerce/ProductsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessCommerce } from "@/lib/workspace-access";

export default async function ProductsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  // Feature disabled for this workspace (Settings → Features) — keep it invisible.
  if (!me.workspace?.commerceEnabled) {
    redirect("/dashboard");
  }

  if (!canAccessCommerce(String(me.role))) {
    return (
      <PageContainer>
        <PageHeader
          title="Products"
          description="Products mirrored from your Meta catalogs."
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
        title="Products"
        description="Products mirrored from your Meta catalogs. Search and filter by catalog."
      />
      <ProductsClient meRole={String(me.role)} />
    </PageContainer>
  );
}
