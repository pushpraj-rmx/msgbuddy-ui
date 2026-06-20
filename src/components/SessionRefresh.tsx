"use client";

import { useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";
import { refreshAccessToken } from "@/lib/axios";
import { parseJwtExpMs } from "@/lib/jwt";

const CHECK_MS = 60_000;
/** Refresh before expiry so API calls and SSE rarely hit a stale access token. */
const REFRESH_BEFORE_MS = 5 * 60_000;

/**
 * Proactively rotates the access token via the refresh cookie before JWT expiry.
 * Without this, the app only refreshes after a 401; failures there redirect to /login.
 */
export function SessionRefresh() {
  const inFlight = useRef(false);

  useEffect(() => {
    const tick = async () => {
      const token = getToken();
      if (!token || inFlight.current) return;
      const expMs = parseJwtExpMs(token);
      if (expMs == null) return;
      if (expMs > Date.now() + REFRESH_BEFORE_MS) return;
      inFlight.current = true;
      try {
        await refreshAccessToken();
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
