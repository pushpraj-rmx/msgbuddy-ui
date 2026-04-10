import { AppLayout } from "@/components/AppLayout";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { ReloadButton } from "@/components/ui/ReloadButton";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me: MeResponse;
  try {
    me = await serverFetch<MeResponse>(endpoints.auth.me);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load current user.";
    return (
      <div className="min-h-[60dvh] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 rounded-box border border-base-300 bg-base-100 p-6">
          <div className="space-y-1">
            <h1 className="text-base font-semibold">Service temporarily unavailable</h1>
            <p className="text-sm text-base-content/70">
              The server returned an error. Your session is fine — this is not a
              logout. Please wait a moment and try again.
            </p>
          </div>
          <p className="font-mono text-xs text-base-content/40">{message}</p>
          <ReloadButton />
        </div>
      </div>
    );
  }

  return <AppLayout me={me}>{children}</AppLayout>;
}
