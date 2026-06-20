"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { WhatsAppOnboardingPanel } from "@/components/integrations/WhatsAppOnboardingPanel";
import { whatsappApi, type WorkspaceCloudApiConfigResponse } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/axios";

const isDev = process.env.NODE_ENV === "development";

function devLog(...args: unknown[]) {
  if (isDev) console.log(...args);
}

function isMultiNumberPhoneIdRequiredMessage(message: string | null | undefined): boolean {
  if (!message || typeof message !== "string") return false;
  return message.includes("phone_number_id is required when the WABA has multiple");
}

const APP_ID = "303289632797814";
const CONFIG_ID = "1592612271863244";
const FB_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

/** Origins allowed for Meta Embedded Signup postMessage (business.facebook.com is used by Embedded Signup) */
const META_POSTMESSAGE_ORIGINS = [
  "https://business.facebook.com",
  "https://www.facebook.com",
];

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: { appId: string; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras: { setup: Record<string, never> };
        }
      ) => void;
    };
  }
}

type ConnectionStatus = "idle" | "loading" | "connected" | "error";
type ExchangeCodePayload = {
  code: string;
  waba_id: string;
  business_id?: string;
  /** Optional: from Embedded Signup FINISH when user selected a number */
  phone_number_id?: string;
};

type EmbeddedSignupContext = {
  waba_id: string | null;
  business_id: string | null;
  phone_number_id: string | null;
};

type StatusErrorBody = { statusCode?: number; message?: string };

function isConnected(config: WorkspaceCloudApiConfigResponse | null): boolean {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken === true);
}

export function WhatsAppIntegrationPage({
  initialCloudApiConfig = null,
  variant = "single",
  atLimit = false,
  onConnected,
}: {
  initialCloudApiConfig?: WorkspaceCloudApiConfigResponse | null;
  variant?: "single" | "connectOnly";
  atLimit?: boolean;
  onConnected?: () => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    isConnected(initialCloudApiConfig) ? "connected" : "idle"
  );
  const [connectedDisplay, setConnectedDisplay] = useState<{
    phoneNumberId?: string;
    wabaId?: string;
  }>(() =>
    initialCloudApiConfig
      ? {
          phoneNumberId: initialCloudApiConfig.phoneNumberId || undefined,
          wabaId: initialCloudApiConfig.wabaId || undefined,
        }
      : {}
  );
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && !!window.FB
  );
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [signupContext, setSignupContext] = useState<EmbeddedSignupContext>({
    waba_id: null,
    business_id: null,
    phone_number_id: null,
  });
  const pendingCodeRef = useRef<string | null>(null);
  const signupContextRef = useRef(signupContext);
  const lastExchangeRef = useRef<{
    code: string;
    waba: string;
    business: string | null;
    phoneNumberId?: string;
  } | null>(null);
  const [needsPhoneNumberId, setNeedsPhoneNumberId] = useState(false);
  const [retryPhoneNumberId, setRetryPhoneNumberId] = useState("");

  const queryClient = useQueryClient();

  const connectionQuery = useQuery({
    queryKey: ["whatsapp", "connection"],
    queryFn: () => whatsappApi.getConnection(),
    enabled: status === "connected",
    staleTime: 15_000,
    retry: 1,
  });

  const phoneNumberId =
    connectedDisplay.phoneNumberId ||
    connectionQuery.data?.phoneNumberId ||
    initialCloudApiConfig?.phoneNumberId ||
    "";

  const phoneStatusQuery = useQuery({
    queryKey: ["whatsapp", "phone-status", phoneNumberId],
    queryFn: () => whatsappApi.fetchPhoneStatus(phoneNumberId),
    enabled: status === "connected" && Boolean(phoneNumberId.trim()),
    staleTime: 30_000,
    retry: 1,
  });

  const performExchange = useCallback(
    (
      code: string,
      waba: string,
      business: string | null,
      phoneNumberIdOpt?: string | null
    ) => {
      setStatus("loading");
      setNeedsPhoneNumberId(false);
      const payload: ExchangeCodePayload = {
        code,
        waba_id: waba,
        ...(business ? { business_id: business } : {}),
        ...(phoneNumberIdOpt?.trim()
          ? { phone_number_id: phoneNumberIdOpt.trim() }
          : {}),
      };
      lastExchangeRef.current = {
        code,
        waba,
        business,
        phoneNumberId: phoneNumberIdOpt?.trim() || undefined,
      };
      devLog("[WhatsApp] POST /whatsapp/exchange-code (authorization code not logged)");
      api
        .post(endpoints.whatsapp.exchangeCode, payload)
        .then(async (exchangeResponse) => {
          const body = exchangeResponse?.data as {
            phoneNumberId?: string;
            wabaId?: string;
          };
          setConnectedDisplay({
            wabaId: body?.wabaId ?? waba,
            phoneNumberId: body?.phoneNumberId,
          });
          setStatus("connected");
          setNeedsPhoneNumberId(false);
          setRetryPhoneNumberId("");
          await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connections"] });
          await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connection"] });
          onConnected?.();
        })
        .catch((error: unknown) => {
          const details = (error as { response?: { data?: unknown; status?: number } })
            ?.response;
          const backendMessage =
            (details?.data as { message?: string } | undefined)?.message ?? null;
          if (isDev) {
            devLog("[WhatsApp] exchange-code failed", details?.status);
          }
          if (
            details?.status === 400 &&
            isMultiNumberPhoneIdRequiredMessage(backendMessage)
          ) {
            setNeedsPhoneNumberId(true);
            setExchangeError(
              `${backendMessage} Paste the Meta phone number ID for the number you want, then retry. OAuth codes may be single-use — if retry fails, use Connect with Facebook again.`
            );
            setStatus("idle");
            return;
          }
          setExchangeError(
            typeof backendMessage === "string"
              ? backendMessage
              : "Failed to connect. Please try again."
          );
          setStatus("error");
        });
    },
    [queryClient, onConnected]
  );

  useEffect(() => {
    signupContextRef.current = signupContext;
  }, [signupContext]);

  // Load Facebook JS SDK
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already loaded
    if (window.FB) {
      setSdkReady(true);
      return;
    }

    // Set init callback (must be set before script loads)
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: APP_ID, xfbml: false, version: "v24.0" });
      setSdkReady(true);
    };

    // If script tag already in DOM (re-mount / HMR), just poll for FB
    const existingScript = document.querySelector(`script[src="${FB_SDK_URL}"]`);
    if (existingScript) {
      const poll = setInterval(() => {
        if (window.FB) {
          clearInterval(poll);
          setSdkReady(true);
        }
      }, 200);
      return () => clearInterval(poll);
    }

    // Insert the script
    const script = document.createElement("script");
    script.src = FB_SDK_URL;
    script.async = true;
    script.onerror = () => {
      console.error("[WhatsApp] Failed to load Facebook SDK from connect.facebook.net");
    };
    document.head.appendChild(script);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Meta Embedded Signup session events
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      if (!META_POSTMESSAGE_ORIGINS.includes(event.origin)) return;
      const rawData = event.data;
      const data =
        typeof rawData === "string"
          ? (() => {
              try {
                return JSON.parse(rawData) as Record<string, unknown>;
              } catch {
                return null;
              }
            })()
          : rawData;
      if ((data as { type?: string } | null)?.type === "WA_EMBEDDED_SIGNUP") {
        devLog("[WhatsApp][Meta Event] WA_EMBEDDED_SIGNUP type received");

        const eventName =
          (data as { event?: string })?.event ||
          (data as { data?: { event?: string } })?.data?.event;
        if (eventName === "FINISH") {
          const wabaId =
            (data as { waba_id?: string })?.waba_id ||
            (data as { data?: { waba_id?: string } })?.data?.waba_id ||
            null;
          const businessId =
            (data as { business_id?: string })?.business_id ||
            (data as { data?: { business_id?: string } })?.data?.business_id ||
            null;
          const finishPhoneNumberId =
            (data as { phone_number_id?: string })?.phone_number_id ||
            (data as { data?: { phone_number_id?: string } })?.data?.phone_number_id ||
            null;

          setSignupContext({
            waba_id: wabaId,
            business_id: businessId,
            phone_number_id: finishPhoneNumberId,
          });
          setExchangeError(null);
          devLog("[WhatsApp] Embedded Signup FINISH (waba_id / business_id captured; phone_number_id not logged)");

          const wabaIdTrimmed = wabaId?.trim() || null;

          // If we already have a pending auth code from the FB.login callback
          // (code arrived before FINISH event), use it now.
          const pendingCode = pendingCodeRef.current;
          if (pendingCode && wabaIdTrimmed) {
            pendingCodeRef.current = null;
            performExchange(
              pendingCode,
              wabaIdTrimmed,
              businessId ?? null,
              finishPhoneNumberId
            );
          }
          // Do NOT open a second FB.login popup here — the original FB.login
          // callback from handleConnect will fire with the auth code.
          // Opening another popup causes browsers to block it.
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [performExchange]);

  const handleConnect = useCallback(() => {
    if (!window.FB) {
      // Remove any existing failed script tag and try fresh
      const existing = document.querySelector(`script[src="${FB_SDK_URL}"]`);
      if (existing) existing.remove();

      console.warn("[WhatsApp] FB SDK not available — loading on demand");
      setExchangeError("Loading Facebook SDK…");
      window.fbAsyncInit = () => {
        if (window.FB) {
          window.FB.init({ appId: APP_ID, xfbml: true, version: "v24.0" });
        }
        setSdkReady(true);
        setExchangeError(null);
      };
      const s = document.createElement("script");
      s.src = FB_SDK_URL;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => {
        // fbAsyncInit should fire, but as a safety net:
        setTimeout(() => {
          if (window.FB && !sdkReady) {
            window.FB.init({ appId: APP_ID, xfbml: true, version: "v24.0" });
            setSdkReady(true);
            setExchangeError(null);
          }
        }, 500);
      };
      s.onerror = () => setExchangeError("Facebook SDK failed to load. Disable ad blockers and refresh the page.");
      document.head.appendChild(s);
      return;
    }
    setCancelMessage(null);
    setExchangeError(null);
    setNeedsPhoneNumberId(false);
    setRetryPhoneNumberId("");
    setStatus("loading");
    devLog("[WhatsApp] Opening Facebook login popup");
    window.FB.login(
      (response) => {
        devLog("[WhatsApp] FB.login callback", { status: response.status, hasCode: !!response.authResponse?.code });
        const code = response.authResponse?.code;

        if (!code) {
          // The Embedded Signup FINISH event may have already fired with waba_id.
          // If so, we just don't have a code yet — don't show an error.
          // Give the FINISH handler a chance to arrive and retry.
          const ctx = signupContextRef.current;
          if (ctx.waba_id) {
            // FINISH already arrived but no code — the user completed signup
            // but FB.login didn't return a code. This is a known Meta quirk.
            // Wait briefly, then show a clear message.
            devLog("[WhatsApp] FB.login returned no code but FINISH already fired — waiting for retry");
            setStatus("idle");
            setExchangeError(
              "Meta login completed but did not return an authorization code. Please click Connect with Facebook again."
            );
          } else if (response.status === "unknown" || !response.authResponse) {
            // User explicitly cancelled or closed the popup early
            setStatus("idle");
            setCancelMessage("Connection cancelled.");
          } else {
            // Unexpected: FB returned a non-unknown status but no code
            setStatus("idle");
            setExchangeError("Facebook login did not return a code. Please try again.");
          }
          return;
        }

        const ctx = signupContextRef.current;
        const wabaId = ctx.waba_id?.trim() || null;
        if (!wabaId) {
          // Code arrived before FINISH event — store it and wait for FINISH
          pendingCodeRef.current = code;
          devLog("[WhatsApp] Code received, waiting for FINISH event with waba_id");
          // Don't show an error — the FINISH handler will pick up the pending code
          return;
        }

        performExchange(
          code,
          wabaId,
          ctx.business_id ?? null,
          ctx.phone_number_id?.trim() ? ctx.phone_number_id : null
        );
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }, [performExchange, sdkReady]);

  const handleRetryExchangeWithPhoneId = useCallback(() => {
    const last = lastExchangeRef.current;
    if (!last) return;
    const extra =
      retryPhoneNumberId.trim() || last.phoneNumberId || signupContextRef.current.phone_number_id?.trim();
    performExchange(last.code, last.waba, last.business, extra || null);
  }, [performExchange, retryPhoneNumberId]);

  if (variant === "connectOnly") {
    if (atLimit) {
      return (
        <p className="text-[0.75rem] text-warning">
          Phone number limit reached. Upgrade your plan to connect more.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {cancelMessage && <p className="text-[0.75rem] text-warning">{cancelMessage}</p>}
        {exchangeError && <p className="text-[0.75rem] text-error">{exchangeError}</p>}

        {needsPhoneNumberId ? (
          <div className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
            <p className="text-[0.75rem] text-base-content/65">
              This WABA has multiple numbers. Enter the phone number ID you want, then retry.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="form-control flex-1 min-w-[200px] max-w-xs">
                <span className="op-label mb-1">Phone number ID</span>
                <input
                  type="text"
                  className="input input-bordered input-sm font-mono"
                  value={retryPhoneNumberId}
                  onChange={(e) => setRetryPhoneNumberId(e.target.value.trim())}
                  placeholder="From Meta Business Suite"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRetryExchangeWithPhoneId}
                disabled={!retryPhoneNumberId.trim()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleConnect}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Connecting…
            </>
          ) : (
            "Connect with Facebook"
          )}
        </button>
      </div>
    );
  }

  /* ── Single variant: connected state ── */
  if (status === "connected") {
    const queryError = phoneStatusQuery.error as ApiError | null;
    const errorStatus = queryError?.status;
    const errorMessage =
      (queryError?.data as StatusErrorBody | undefined)?.message ||
      queryError?.message ||
      "Failed to load phone number status.";

    const statusData = phoneStatusQuery.data;
    const displayPhone = statusData?.displayPhoneNumber || phoneNumberId || "Unknown";

    return (
      <div className="space-y-5">
        <div>
          <span className="op-label">integration</span>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">WhatsApp</h1>
          <p className="mt-0.5 text-[0.8125rem] text-base-content/60">
            Manage your WhatsApp Business connection.
          </p>
        </div>

        {/* Connection status */}
        <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="op-tag op-tag-ok">Connected</span>
            <span className="text-[0.8125rem] font-medium tabular-nums">
              {connectedDisplay.phoneNumberId || connectedDisplay.wabaId || "WhatsApp Business linked"}
            </span>
          </div>

          {/* Phone status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="op-label">phone status</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => phoneStatusQuery.refetch()}
              disabled={!phoneStatusQuery.isFetched || phoneStatusQuery.isFetching}
            >
              {phoneStatusQuery.isFetching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Refresh"
              )}
            </button>
          </div>

          {!phoneNumberId?.trim() ? (
            <p className="text-[0.75rem] text-warning">
              No phone number ID found. Refresh after connecting.
            </p>
          ) : phoneStatusQuery.isLoading ? (
            <div className="flex gap-2">
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-5 w-20" />
            </div>
          ) : errorStatus === 404 ? (
            <p className="text-[0.75rem] text-base-content/50">Not connected.</p>
          ) : errorStatus === 422 ? (
            <p className="text-[0.75rem] text-warning">{errorMessage}</p>
          ) : phoneStatusQuery.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.75rem] text-error/70">{errorMessage}</p>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => phoneStatusQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <div className="space-y-0.5">
                <span className="op-label">phone</span>
                <p className="text-[0.8125rem] font-medium tabular-nums">{displayPhone}</p>
              </div>
              {statusData?.verifiedName && (
                <div className="space-y-0.5">
                  <span className="op-label">verified name</span>
                  <p className="text-[0.8125rem] font-medium">{statusData.verifiedName}</p>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-1.5 pb-0.5">
                {statusData?.qualityRating && (
                  <span
                    className={
                      statusData.qualityRating === "GREEN"
                        ? "op-tag op-tag-ok"
                        : statusData.qualityRating === "RED"
                          ? "op-tag op-tag-danger"
                          : "op-tag op-tag-warn"
                    }
                  >
                    {statusData.qualityRating}
                  </span>
                )}
                {statusData?.verificationStatus && (
                  <span className="op-tag">{statusData.verificationStatus}</span>
                )}
                {statusData?.status && (
                  <span className="op-tag">{statusData.status}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {phoneNumberId?.trim() ? (
          <WhatsAppOnboardingPanel
            phoneNumberId={phoneNumberId}
            registrationPending={connectionQuery.data?.registrationPending}
            metaPhoneStatus={connectionQuery.data?.metaPhoneStatus ?? undefined}
            metaVerificationStatus={connectionQuery.data?.metaVerificationStatus ?? undefined}
          />
        ) : null}
      </div>
    );
  }

  /* ── Single variant: idle / error state ── */
  return (
    <div className="space-y-5">
      <div>
        <span className="op-label">integration</span>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">WhatsApp</h1>
        <p className="mt-0.5 text-[0.8125rem] text-base-content/60">
          Connect your WhatsApp Business account to start messaging.
        </p>
      </div>

      <div className="op-grain relative rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-3">
        <span className="op-label">connect</span>
        <p className="text-[0.875rem] font-semibold">Connect WhatsApp Business</p>
        <p className="text-[0.75rem] text-base-content/55">
          Link your WhatsApp Business account via Meta Embedded Signup.
        </p>

        {cancelMessage && <p className="text-[0.75rem] text-warning">{cancelMessage}</p>}
        {exchangeError && <p className="text-[0.75rem] text-error">{exchangeError}</p>}

        {needsPhoneNumberId ? (
          <div className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
            <p className="text-[0.75rem] text-base-content/65">
              This WABA has multiple numbers. Enter the phone number ID you want, then retry.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="form-control flex-1 min-w-[200px] max-w-xs">
                <span className="op-label mb-1">Phone number ID</span>
                <input
                  type="text"
                  className="input input-bordered input-sm font-mono"
                  value={retryPhoneNumberId}
                  onChange={(e) => setRetryPhoneNumberId(e.target.value.trim())}
                  placeholder="From Meta Business Suite"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRetryExchangeWithPhoneId}
                disabled={!retryPhoneNumberId.trim()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleConnect}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Connecting…
            </>
          ) : (
            "Connect with Facebook"
          )}
        </button>
      </div>

      {status === "error" && exchangeError && (
        <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{exchangeError}</p>
        </div>
      )}
    </div>
  );
}
