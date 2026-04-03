import { AppLayout } from "@/components/AppLayout";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import Link from "next/link";

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
      <div className="min-h-[60dvh] p-6">
        <div className="mx-auto max-w-xl space-y-3 rounded-box border border-base-300 bg-base-100 p-5">
          <h1 className="text-lg font-semibold">Session error</h1>
          <p className="text-sm text-base-content/70">
            We couldn’t load your session profile. This is usually a temporary
            backend error (not a logout).
          </p>
          <pre className="max-h-56 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 text-xs">
            {message}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/dashboard" className="btn btn-sm btn-primary">
              Retry
            </Link>
            <Link href="/login" className="btn btn-sm btn-ghost">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AppLayout me={me}>{children}</AppLayout>;
}
