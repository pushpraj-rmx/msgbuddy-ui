import type { Metadata } from "next";
import StorefrontClient from "@/components/storefront/StorefrontClient";

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
  return <StorefrontClient handle={handle} />;
}
