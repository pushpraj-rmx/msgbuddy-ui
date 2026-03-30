"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { WhatsAppOnboardingPanel } from "@/components/integrations/WhatsAppOnboardingPanel";
import { whatsappApi, type WorkspaceCloudApiConfigResponse } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

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
  onConnected,
}: {
  initialCloudApiConfig?: WorkspaceCloudApiConfigResponse | null;
  variant?: "single" | "connectOnly";
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

  // Load Facebook JS SDK asynchronously (do not remove fbAsyncInit in cleanup so script can call it after load)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.FB) {
      return;
    }
    window.fbAsyncInit = () => {
      if (window.FB) {
        window.FB.init({
          appId: APP_ID,
          xfbml: true,
          version: "v24.0",
        });
      }
      setSdkReady(true);
    };
    const script = document.createElement("script");
    script.src = FB_SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-app-id", APP_ID);
    script.onload = () => {
      if (window.FB) setSdkReady(true);
    };
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }, [onConnected]);

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

          const pendingCode = pendingCodeRef.current;
          if (pendingCode && wabaIdTrimmed) {
            pendingCodeRef.current = null;
            performExchange(
              pendingCode,
              wabaIdTrimmed,
              businessId ?? null,
              finishPhoneNumberId
            );
          } else if (wabaIdTrimmed && window.FB) {
            setStatus("loading");
            setExchangeError(null);
            devLog("[WhatsApp] FINISH: opening FB.login for code");
            window.FB.login(
              (response) => {
                const code = response.authResponse?.code;
                if (!code) {
                  setStatus("idle");
                  if (response.status === "unknown" || !response.authResponse) {
                    setExchangeError("Connection cancelled. Click Connect with Facebook to try again.");
                  } else {
                    setExchangeError("Facebook login did not return a code. Please try again.");
                  }
                  return;
                }
                performExchange(code, wabaIdTrimmed, businessId ?? null, finishPhoneNumberId);
              },
              {
                config_id: CONFIG_ID,
                response_type: "code",
                override_default_response_type: true,
                extras: { setup: {} },
              }
            );
          }
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [performExchange]);

  const handleConnect = useCallback(() => {
    if (!window.FB || !sdkReady) return;
    setCancelMessage(null);
    setExchangeError(null);
    setNeedsPhoneNumberId(false);
    setRetryPhoneNumberId("");
    setStatus("loading");
    devLog("[WhatsApp] Opening Facebook login popup");
    window.FB.login(
      (response) => {
        devLog("[WhatsApp] FB.login callback (auth code not logged)");
        const code = response.authResponse?.code;

        if (!code) {
          setStatus("idle");
          if (response.status === "unknown" || !response.authResponse) {
            setCancelMessage("Connection cancelled.");
          } else {
            setExchangeError("Facebook login did not return a code.");
          }
          return;
        }

        const ctx = signupContextRef.current;
        const wabaId = ctx.waba_id?.trim() || null;
        if (!wabaId) {
          pendingCodeRef.current = code;
          setStatus("idle");
          setExchangeError(
            "Embedded Signup not finished yet. Complete the Meta flow first—or if you just did, connection will complete automatically when it finishes."
          );
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
    return (
      <div className="space-y-4">
        <div className="card card-border bg-base-200">
          <div className="card-body">
            <h2 className="card-title">Add WhatsApp number</h2>
            <p className="text-base-content/80">
              Connect an additional WhatsApp Business phone number using Meta Embedded Signup.
            </p>
            {cancelMessage && <p className="text-sm text-warning">{cancelMessage}</p>}
            {exchangeError && <p className="text-sm text-error">{exchangeError}</p>}
            {needsPhoneNumberId ? (
              <div className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
                <p className="text-sm text-base-content/80">
                  Enter the Meta phone number ID for the number you want to use, then retry. If this
                  fails, start Connect with Facebook again — OAuth codes are often single-use.
                </p>
                <label className="input input-bordered flex items-center gap-2 w-full max-w-md">
                  <span className="label text-xs whitespace-nowrap">Phone number ID</span>
                  <input
                    type="text"
                    className="grow font-mono text-sm"
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
                  Retry exchange with phone number ID
                </button>
              </div>
            ) : null}
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!sdkReady || status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Connecting…
                  </>
                ) : (
                  "Connect with Facebook"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "connected") {
    const queryError = phoneStatusQuery.error as AxiosError<StatusErrorBody> | null;
    const errorStatus = queryError?.response?.status;
    const errorMessage =
      queryError?.response?.data?.message ||
      queryError?.message ||
      "Failed to load phone number status.";

    const statusData = phoneStatusQuery.data;
    const displayPhone = statusData?.displayPhoneNumber || phoneNumberId || "Unknown";

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp Integration</h1>
          <p className="text-sm text-base-content/60">
            Manage your WhatsApp Business connection.
          </p>
        </div>
        <div className="card card-border bg-base-200">
          <div className="card-body">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success badge-lg">
                Connected
              </span>
              <span className="text-base-content/80">
                {connectedDisplay.phoneNumberId || connectedDisplay.wabaId || "WhatsApp Business linked"}
              </span>
            </div>
            <p className="text-sm text-base-content/60">
              Your WhatsApp Business account is linked. Connection state is loaded from the server on refresh.
            </p>
          </div>
        </div>

        <div className="card card-border bg-base-200">
          <div className="card-body gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="card-title">Phone number status</h2>
                <p className="text-sm text-base-content/60">
                  Live status from Meta for this workspace.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => phoneStatusQuery.refetch()}
                disabled={!phoneStatusQuery.isFetched || phoneStatusQuery.isFetching}
              >
                {phoneStatusQuery.isFetching ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Refreshing…
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
            </div>

            {!phoneNumberId?.trim() ? (
              <div role="alert" className="alert alert-warning alert-soft">
                <span>
                  No phone number id found for this workspace. Refresh the page after connecting, or reconnect WhatsApp.
                </span>
              </div>
            ) : phoneStatusQuery.isLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-1/3" />
              </div>
            ) : errorStatus === 404 ? (
              <div role="alert" className="alert alert-info alert-soft">
                <span>WhatsApp not connected for this workspace.</span>
              </div>
            ) : errorStatus === 422 ? (
              <div role="alert" className="alert alert-warning alert-soft">
                <div className="space-y-1">
                  <div>WhatsApp connection inactive.</div>
                  <div className="text-sm opacity-70">{errorMessage}</div>
                </div>
              </div>
            ) : phoneStatusQuery.isError ? (
              <div role="alert" className="alert alert-error alert-soft">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Failed to load phone number status.</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => phoneStatusQuery.refetch()}
                      disabled={phoneStatusQuery.isFetching}
                    >
                      Retry
                    </button>
                  </div>
                  <details className="collapse collapse-arrow bg-base-100/40">
                    <summary className="collapse-title text-sm font-medium">
                      Details
                    </summary>
                    <div className="collapse-content">
                      <pre className="text-xs whitespace-pre-wrap text-base-content/70">
                        {errorMessage}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-base-content/60">Display phone</div>
                  <div className="font-medium">{displayPhone}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-base-content/60">Verified name</div>
                  <div className="font-medium">
                    {statusData?.verifiedName || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-base-content/60">Verification</div>
                  <div className="font-medium">
                    {statusData?.verificationStatus || "Unknown"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-base-content/60">Quality</div>
                  <div className="font-medium">
                    {statusData?.qualityRating || "Unknown"}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-base-content/60">Meta status</div>
                  <div className="font-medium">{statusData?.status || "Unknown"}</div>
                </div>
              </div>
            )}
          </div>
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp Integration</h1>
        <p className="text-sm text-base-content/60">
          Connect your WhatsApp Business account to start messaging customers.
        </p>
      </div>
      <div className="card card-border bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Connect WhatsApp Business</h2>
          <p className="text-base-content/80">
            Connect your WhatsApp Business account to start messaging customers.
          </p>
          <div className="text-xs text-base-content/60">
            <div>
              Embedded Signup waba_id:{" "}
              <span className="font-medium">
                {signupContext.waba_id ?? "Not captured yet"}
              </span>
            </div>
            <div>
              Embedded Signup business_id:{" "}
              <span className="font-medium">
                {signupContext.business_id ?? "Not captured yet"}
              </span>
            </div>
            <div>
              Embedded Signup phone_number_id:{" "}
              <span className="font-medium">
                {signupContext.phone_number_id ?? "Not captured yet"}
              </span>
            </div>
          </div>
          {cancelMessage && (
            <p className="text-sm text-warning">{cancelMessage}</p>
          )}
          {exchangeError && <p className="text-sm text-error">{exchangeError}</p>}
          {needsPhoneNumberId ? (
            <div className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
              <p className="text-sm text-base-content/80">
                Enter the Meta phone number ID for the number you want to use, then retry. If this
                fails, start Connect with Facebook again — OAuth codes are often single-use.
              </p>
              <label className="input input-bordered flex items-center gap-2 w-full max-w-md">
                <span className="label text-xs whitespace-nowrap">Phone number ID</span>
                <input
                  type="text"
                  className="grow font-mono text-sm"
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
                Retry exchange with phone number ID
              </button>
            </div>
          ) : null}
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={!sdkReady || status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Connecting…
                </>
              ) : (
                "Connect with Facebook"
              )}
            </button>
          </div>
        </div>
      </div>
      {status === "error" && (
        <div role="alert" className="alert alert-error">
          <span>Failed to connect. Please try again.</span>
        </div>
      )}
    </div>
  );
}
