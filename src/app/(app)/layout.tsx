import { AppLayout } from "@/components/AppLayout";
import { serverFetch, type MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  return <AppLayout me={me}>{children}</AppLayout>;
}
