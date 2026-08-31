"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/BrandIcon";
import { authApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Desktop browser-login handoff (runs in the user's system browser).
 *
 * The desktop app opens this page with `?state=…&challenge=…` (a PKCE
 * code_challenge it generated). If the browser is signed in, we mint a
 * single-use code bound to that challenge and hand it back to the app via the
 * `msgbuddy://auth` deep link. If not signed in, we bounce through the normal
 * login and return here.
 */

type Status = "working" | "done" | "error";

export default function DesktopAuthPage() {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Connecting to the desktop app…");
  const deepLinkRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const openDesktopApp = useCallback(() => {
    if (deepLinkRef.current) window.location.href = deepLinkRef.current;
  }, []);

  useEffect(() => {
    if (startedRef.current) return; // run once
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const challenge = params.get("challenge");

    if (!state || !challenge) {
      setStatus("error");
      setMessage("This link is missing required parameters. Restart sign-in from the desktop app.");
      return;
    }

    // Not signed in here → go through the normal login, then come back.
    if (!getToken()) {
      const next = `/desktop-auth${window.location.search}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    void (async () => {
      try {
        const { code } = await authApi.desktopAuthorize(challenge);
        const deepLink = `msgbuddy://auth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
        deepLinkRef.current = deepLink;
        setStatus("done");
        setMessage("Signed in. Returning you to the MsgBuddy desktop app…");
        window.location.href = deepLink;
      } catch {
        setStatus("error");
        setMessage("Could not complete sign-in. Please restart it from the desktop app.");
      }
    })();
  }, []);

  const expression =
    status === "done" ? "success" : status === "error" ? "error" : "thinking";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-base-200 p-6">
      <div className="w-full max-w-sm card bg-base-100 border border-base-300 p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-box border border-base-300 bg-base-200">
          <BrandIcon expression={expression} className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold tracking-[-0.015em]">
            {status === "error" ? "Sign-in interrupted" : "Signing in to Desktop"}
          </h1>
          <p className="text-sm text-base-content/60">{message}</p>
        </div>

        {status === "working" && (
          <span className="loading loading-spinner loading-sm text-primary" />
        )}

        {status === "done" && (
          <div className="space-y-3">
            <p className="text-xs text-base-content/50">
              You can close this tab. If the app didn’t reopen, use the button below.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openDesktopApp}>
              Open MsgBuddy Desktop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
