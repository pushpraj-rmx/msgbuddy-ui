import type { Metadata } from "next";
import StorefrontClient from "@/components/storefront/StorefrontClient";
import { PolicyFooter } from "./policies/PolicyFooter";

export const metadata: Metadata = {
  title: "Subscribe",
  robots: { index: false }, // per-merchant storefront, not for search indexing
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <>
      <StorefrontClient handle={handle} />
      {/* Server-rendered: the policy links must be in the initial HTML. They are
          what a payment-gateway reviewer looks for, and rendering them inside the
          client component hid them until the catalog fetch resolved. */}
      <PolicyFooter handle={handle} />
    </>
  );
}
