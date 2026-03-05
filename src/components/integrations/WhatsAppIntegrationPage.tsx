"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type { WorkspaceCloudApiConfigResponse } from "@/lib/api";

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
};

type EmbeddedSignupContext = {
  waba_id: string | null;
  business_id: string | null;
};

function isConnected(config: WorkspaceCloudApiConfigResponse | null): boolean {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken === true);
}

export function WhatsAppIntegrationPage({
  initialCloudApiConfig = null,
}: {
  initialCloudApiConfig?: WorkspaceCloudApiConfigResponse | null;
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
  });
  const pendingCodeRef = useRef<string | null>(null);
  const signupContextRef = useRef(signupContext);
  signupContextRef.current = signupContext;

  // Clear "not finished yet" error once we have waba_id (e.g. FINISH arrived after the click)
  useEffect(() => {
    if (signupContext.waba_id?.trim() && exchangeError?.includes("Embedded Signup not finished yet")) {
      setExchangeError(null);
    }
  }, [signupContext.waba_id, exchangeError]);

  // Load Facebook JS SDK asynchronously (do not remove fbAsyncInit in cleanup so script can call it after load)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.FB) {
      setSdkReady(true);
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
  }, []);

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
        console.log("[WhatsApp][Meta Event] WA_EMBEDDED_SIGNUP:", data);

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

          setSignupContext({
            waba_id: wabaId,
            business_id: businessId,
          });
          setExchangeError(null);
          console.log("[WhatsApp] Embedded Signup FINISH captured:", {
            waba_id: wabaId,
            business_id: businessId,
          });

          const wabaIdTrimmed = wabaId?.trim() || null;
          const runExchange = (code: string, waba: string, business: string | null) => {
            setStatus("loading");
            const payload: ExchangeCodePayload = {
              code,
              waba_id: waba,
              ...(business ? { business_id: business } : {}),
            };
            console.log("[WhatsApp] Exchanging code with backend:", payload);
            api
              .post(endpoints.whatsapp.exchangeCode, payload)
              .then((exchangeResponse) => {
                console.log(
                  "[WhatsApp] Backend /whatsapp/exchange-code success:",
                  exchangeResponse?.data
                );
                setConnectedDisplay({ wabaId: waba });
                setStatus("connected");
              })
              .catch((error: unknown) => {
                const details = (error as { response?: { data?: unknown; status?: number } })
                  ?.response;
                const backendMessage =
                  (details?.data as { message?: string } | undefined)?.message ?? null;
                console.error("[WhatsApp] Backend /whatsapp/exchange-code failed:", {
                  status: details?.status,
                  data: details?.data,
                  error,
                });
                setExchangeError(
                  typeof backendMessage === "string" ? backendMessage : "Failed to connect. Please try again."
                );
                setStatus("error");
              });
          };

          const pendingCode = pendingCodeRef.current;
          if (pendingCode && wabaIdTrimmed) {
            pendingCodeRef.current = null;
            runExchange(pendingCode, wabaIdTrimmed, businessId ?? null);
          } else if (wabaIdTrimmed && window.FB) {
            setStatus("loading");
            setExchangeError(null);
            console.log("[WhatsApp] FINISH received with waba_id but no pending code; opening FB.login to get code.");
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
                runExchange(code, wabaIdTrimmed, businessId ?? null);
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
  }, []);

  const handleConnect = useCallback(() => {
    if (!window.FB || !sdkReady) return;
    setCancelMessage(null);
    setExchangeError(null);
    setStatus("loading");
    console.log("[WhatsApp] Opening Facebook login popup...");
    window.FB.login(
      (response) => {
        console.log("[WhatsApp][FB.login] Callback response:", response);
        const code = response.authResponse?.code;

        if (!code) {
          setStatus("idle");
          if (response.status === "unknown" || !response.authResponse) {
            setCancelMessage("Connection cancelled.");
            console.log("[WhatsApp] Connection cancelled or failed.", response);
          } else {
            setExchangeError("Facebook login did not return a code.");
            console.warn("[WhatsApp] Meta login did not return auth code.", response);
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
          console.warn("[WhatsApp] Got code but waba_id not set yet; storing code until FINISH.", {
            signupContext: ctx,
          });
          return;
        }

        const payload: ExchangeCodePayload = {
          code,
          waba_id: wabaId,
          ...(ctx.business_id ? { business_id: ctx.business_id } : {}),
        };
        console.log("[WhatsApp] Sending exchange payload (both code and waba_id):", payload);
        api
          .post(endpoints.whatsapp.exchangeCode, payload)
          .then((exchangeResponse) => {
            console.log(
              "[WhatsApp] Backend /whatsapp/exchange-code success:",
              exchangeResponse?.data
            );
            setConnectedDisplay({ wabaId: wabaId });
            setStatus("connected");
          })
          .catch((error: unknown) => {
            const details = (error as { response?: { data?: unknown; status?: number } })
              ?.response;
            const backendMessage =
              (details?.data as { message?: string } | undefined)?.message ??
              null;
            console.error("[WhatsApp] Backend /whatsapp/exchange-code failed:", {
              status: details?.status,
              data: details?.data,
              error,
            });
            if (details?.status === 400 && backendMessage) {
              setExchangeError(backendMessage);
            } else if (backendMessage) {
              setExchangeError(backendMessage);
            } else {
              setExchangeError("Failed to connect. Please try again.");
            }
            setStatus("error");
          });
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }, [sdkReady]);

  if (status === "connected") {
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
          </div>
          {cancelMessage && (
            <p className="text-sm text-warning">{cancelMessage}</p>
          )}
          {exchangeError && <p className="text-sm text-error">{exchangeError}</p>}
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
