"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  workspaceInvitationsApi,
  type PublicInvitation,
} from "@/lib/api";
import { hasToken } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * /accept-invite?token=... — entry point for invitation links.
 *
 * Three states for an authenticated caller:
 *   - pending → Show "Join {workspace}" button, accept on click.
 *   - accepted/expired/revoked → Show explanatory state with "go to app" link.
 *
 * If the caller isn't authenticated we render sign-in / sign-up links that
 * pass `?next=` back to this URL so the user lands here again after auth.
 */

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  useEffect(() => {
    setIsAuthed(hasToken());
  }, []);

  useEffect(() => {
    if (!token) {
      setLookupError("Missing invitation token.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void workspaceInvitationsApi
      .lookup(token)
      .then((inv) => {
        if (!cancelled) setInvitation(inv);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Invitation not found.";
        setLookupError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await workspaceInvitationsApi.accept(token);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to accept invitation.";
      setAcceptError(msg);
    } finally {
      setAccepting(false);
    }
  };

  // Preserve the full current URL (incl. token) as `?next=` so login/register
  // can route the user back here after auth. We URL-encode so query chars
  // don't fall outside the param.
  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return encodeURIComponent(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BrandLogo className="h-7 w-auto" priority />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-base-content/65">
            <span className="loading loading-spinner loading-sm" />
            Loading invitation…
          </div>
        ) : lookupError ? (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">Invitation unavailable</h1>
            <p className="text-sm text-base-content/70">{lookupError}</p>
            <Link href="/login" className="btn btn-ghost btn-sm">
              Back to sign in
            </Link>
          </div>
        ) : invitation ? (
          <div className="space-y-4">
            <header className="space-y-1">
              <p className="op-label">You&apos;re invited to join</p>
              <h1 className="text-xl font-semibold tracking-tight">
                {invitation.workspaceName}
              </h1>
              <p className="text-[0.8125rem] text-base-content/65">
                Role on join:{" "}
                <span className="font-mono-op text-base-content">
                  {invitation.role}
                </span>
                {invitation.email ? (
                  <>
                    {" "}
                    · for{" "}
                    <span className="font-mono-op text-base-content">
                      {invitation.email}
                    </span>
                  </>
                ) : null}
              </p>
            </header>

            {invitation.status === "expired" ? (
              <div
                role="alert"
                className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm"
              >
                This invitation has expired. Ask an admin to send a new one.
              </div>
            ) : invitation.status === "revoked" ? (
              <div
                role="alert"
                className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
              >
                This invitation has been revoked by an admin.
              </div>
            ) : invitation.status === "accepted" ? (
              <div
                role="status"
                className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-3 py-2 text-sm"
              >
                This invitation has already been accepted.
              </div>
            ) : isAuthed ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      Joining…
                    </>
                  ) : (
                    <>Join {invitation.workspaceName}</>
                  )}
                </button>
                {acceptError ? (
                  <p className="text-[0.8125rem] text-error">{acceptError}</p>
                ) : null}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-base-content/70">
                  Sign in to accept this invitation. If you don&apos;t have a
                  MsgBuddy account yet, create one first.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/login?next=${nextParam}`}
                    className="btn btn-primary btn-sm"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/register?next=${nextParam}`}
                    className="btn btn-outline btn-sm"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            )}

            <p className="font-mono-op text-[0.625rem] text-base-content/40">
              Expires{" "}
              {new Date(invitation.expiresAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  // useSearchParams must be in a Suspense boundary per Next.js 15+.
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
