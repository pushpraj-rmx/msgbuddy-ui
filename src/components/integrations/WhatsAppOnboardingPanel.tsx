"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  whatsappApi,
  type VerificationCodeMethod,
  type WhatsAppOnboardingPhase,
} from "@/lib/api";
import type { AxiosError } from "axios";

const ONBOARDING_QUERY_KEY = "onboarding-status";

function defaultMetaLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const tag = navigator.language || "en-US";
  const [lang, region] = tag.split(/[-_]/);
  if (lang?.toLowerCase() === "en") return "en";
  if (region && region.length === 2) {
    return `${lang.toLowerCase()}_${region.toUpperCase()}`;
  }
  return `${lang || "en"}_${(region || "US").toUpperCase()}`;
}

function getErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ message?: string | string[]; statusCode?: number }>;
  const msg = ax.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return ax.message || "Request failed.";
}

export type WhatsAppOnboardingPanelProps = {
  phoneNumberId: string;
  /** From GET /whatsapp/connections or /whatsapp/connection — drives PIN step when true. */
  registrationPending?: boolean;
  metaPhoneStatus?: string | null;
  metaVerificationStatus?: string | null;
};

export function WhatsAppOnboardingPanel({
  phoneNumberId,
  registrationPending,
  metaPhoneStatus,
  metaVerificationStatus: metaVerificationStatusProp,
}: WhatsAppOnboardingPanelProps) {
  const queryClient = useQueryClient();
  const trimmedId = phoneNumberId?.trim() ?? "";
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [codeMethod, setCodeMethod] = useState<VerificationCodeMethod>("SMS");
  const [language, setLanguage] = useState(defaultMetaLanguage);
  const [localError, setLocalError] = useState<string | null>(null);

  const onboardingQuery = useQuery({
    queryKey: ["whatsapp", ONBOARDING_QUERY_KEY, trimmedId],
    queryFn: () => whatsappApi.getOnboardingStatus(trimmedId),
    enabled: Boolean(trimmedId),
    staleTime: 15_000,
    retry: 1,
  });

  const phase: WhatsAppOnboardingPhase | undefined =
    onboardingQuery.data?.onboarding_phase;

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["whatsapp", ONBOARDING_QUERY_KEY, trimmedId],
    });
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "phone-status", trimmedId] });
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connections"] });
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "connection"] });
  };

  const registerMutation = useMutation({
    mutationFn: () => {
      if (!/^\d{6}$/.test(pin)) {
        return Promise.reject(new Error("PIN must be exactly 6 digits."));
      }
      if (pin !== pinConfirm) {
        return Promise.reject(new Error("PIN and confirmation do not match."));
      }
      return whatsappApi.registerNumber({ phone_number_id: trimmedId, pin });
    },
    onSuccess: async () => {
      setPin("");
      setPinConfirm("");
      setLocalError(null);
      await invalidate();
    },
    onError: (e) => setLocalError(getErrorMessage(e)),
  });

  const requestCodeMutation = useMutation({
    mutationFn: () =>
      whatsappApi.requestVerificationCode({
        phone_number_id: trimmedId,
        code_method: codeMethod,
        language: language.trim() || "en",
      }),
    onSuccess: async () => {
      setLocalError(null);
      await invalidate();
    },
    onError: (e) => {
      const ax = e as AxiosError<{ message?: string | string[] }>;
      const status = ax.response?.status;
      const base = getErrorMessage(e);
      if (status === 429) {
        setLocalError(
          `${base} Wait about 60 seconds before requesting another code.`
        );
      } else {
        setLocalError(base);
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      whatsappApi.verifyNumber({
        phone_number_id: trimmedId,
        code: otpCode.trim(),
      }),
    onSuccess: async () => {
      setOtpCode("");
      setLocalError(null);
      await invalidate();
    },
    onError: (e) => setLocalError(getErrorMessage(e)),
  });

  const ensureMutation = useMutation({
    mutationFn: () => whatsappApi.ensureSubscription({ phone_number_id: trimmedId }),
    onSuccess: async () => {
      setLocalError(null);
      await invalidate();
    },
    onError: (e) => setLocalError(getErrorMessage(e)),
  });

  const metaPhoneUpper = (metaPhoneStatus ?? "").toString().toUpperCase();
  const metaFromOnboarding = onboardingQuery.data?.meta?.status?.toUpperCase() ?? "";

  const showRegister = useMemo(() => {
    if (registrationPending === true) return true;
    if (metaPhoneUpper === "PENDING" || metaFromOnboarding === "PENDING") return true;
    if (phase === "VERIFIED" || phase === "ACTIVE") return false;
    return (
      phase === "CONNECTED" ||
      phase === "PENDING_CONNECT" ||
      phase === "REGISTERING" ||
      phase === "FAILED"
    );
  }, [registrationPending, metaPhoneUpper, metaFromOnboarding, phase]);

  const showRequestOtp = useMemo(() => {
    if (!phase) return false;
    if (registrationPending === true && (phase === "CONNECTED" || phase === "PENDING_CONNECT")) {
      return false;
    }
    return phase === "REGISTERED" || phase === "OTP_PENDING";
  }, [phase, registrationPending]);

  const showVerify = useMemo(() => {
    if (!phase) return false;
    if (registrationPending === true && (phase === "CONNECTED" || phase === "PENDING_CONNECT")) {
      return false;
    }
    return phase === "REGISTERED" || phase === "OTP_PENDING";
  }, [phase, registrationPending]);

  const showComplete = useMemo(() => {
    if (!phase) return false;
    return phase === "VERIFIED" || phase === "ACTIVE";
  }, [phase]);

  const isFailed = phase === "FAILED";

  const metaVerificationBadge =
    metaVerificationStatusProp ??
    onboardingQuery.data?.meta?.code_verification_status ??
    null;

  if (!trimmedId) return null;

  return (
    <div className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="card-title text-base">Number onboarding</h3>
            <p className="text-sm text-base-content/60">
              Set a 6-digit two-step PIN (not your SMS code), then complete SMS/voice verification
              if Meta requires it.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => onboardingQuery.refetch()}
            disabled={onboardingQuery.isFetching}
          >
            {onboardingQuery.isFetching ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Syncing…
              </>
            ) : (
              "Refresh onboarding"
            )}
          </button>
        </div>

        {onboardingQuery.isLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-10 w-full" />
          </div>
        ) : (
          <>
            {onboardingQuery.isError && !showRegister ? (
              <div role="alert" className="alert alert-warning alert-soft">
                <span>{getErrorMessage(onboardingQuery.error)}</span>
              </div>
            ) : null}
            {onboardingQuery.isError && showRegister ? (
              <div role="alert" className="alert alert-warning alert-soft text-sm">
                <span>
                  Could not load live onboarding status ({getErrorMessage(onboardingQuery.error)}).
                  You can still complete registration if your number is pending.
                </span>
              </div>
            ) : null}

            {!onboardingQuery.isError || showRegister ? (
              <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-base-content/60">Phase</span>
              <span className="badge badge-outline">{phase ?? "—"}</span>
              {registrationPending === true ? (
                <span className="badge badge-warning badge-outline">Registration pending</span>
              ) : null}
              {metaPhoneStatus ? (
                <span className="badge badge-ghost">Meta phone: {metaPhoneStatus}</span>
              ) : null}
              {metaVerificationBadge ? (
                <span className="badge badge-ghost">Meta verification: {metaVerificationBadge}</span>
              ) : null}
            </div>

            {localError ? (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                <span>{localError}</span>
              </div>
            ) : null}

            {isFailed ? (
              <div role="alert" className="alert alert-warning alert-soft">
                <span>
                  Onboarding failed. Fix the issue in Meta Business Manager if needed, then try
                  again with the correct two-step PIN below.
                </span>
              </div>
            ) : null}

            {showRegister ? (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">1. Set WhatsApp PIN (Cloud API registration)</legend>
                <p className="label text-base-content/70">
                  Choose a 6-digit PIN for two-step verification (same as in the WhatsApp Business
                  app). Confirm it below — this is not your OAuth or SMS code.
                </p>
                <div className="flex flex-col gap-2 max-w-md sm:flex-row">
                  <label className="input input-bordered flex flex-1 items-center gap-2">
                    <span className="label text-xs whitespace-nowrap">PIN</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      className="grow font-mono"
                      placeholder="••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={registerMutation.isPending}
                    />
                  </label>
                  <label className="input input-bordered flex flex-1 items-center gap-2">
                    <span className="label text-xs whitespace-nowrap">Confirm</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      className="grow font-mono"
                      placeholder="••••••"
                      value={pinConfirm}
                      onChange={(e) =>
                        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      disabled={registerMutation.isPending}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm mt-2"
                  disabled={
                    registerMutation.isPending ||
                    pin.length !== 6 ||
                    pinConfirm.length !== 6 ||
                    pin !== pinConfirm
                  }
                  onClick={() => {
                    setLocalError(null);
                    registerMutation.mutate();
                  }}
                >
                  {registerMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      Registering…
                    </>
                  ) : (
                    "Register number"
                  )}
                </button>
              </fieldset>
            ) : null}

            {showRequestOtp || showVerify ? (
              <fieldset className="fieldset border-base-300 border-t pt-4">
                <legend className="fieldset-legend">2. Phone number verification (OTP)</legend>
                {showRequestOtp ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="form-control w-full max-w-xs">
                      <span className="label">Delivery</span>
                      <select
                        className="select select-bordered select-sm"
                        value={codeMethod}
                        onChange={(e) =>
                          setCodeMethod(e.target.value as VerificationCodeMethod)
                        }
                        disabled={requestCodeMutation.isPending}
                      >
                        <option value="SMS">SMS</option>
                        <option value="VOICE">Voice</option>
                      </select>
                    </label>
                    <label className="form-control w-full max-w-xs">
                      <span className="label">Language</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="en"
                        disabled={requestCodeMutation.isPending}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={requestCodeMutation.isPending}
                      onClick={() => {
                        setLocalError(null);
                        requestCodeMutation.mutate();
                      }}
                    >
                      {requestCodeMutation.isPending ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Sending…
                        </>
                      ) : phase === "OTP_PENDING" ? (
                        "Resend code"
                      ) : (
                        "Send verification code"
                      )}
                    </button>
                  </div>
                ) : null}

                {showVerify ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="form-control w-full max-w-xs">
                      <span className="label">Verification code</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input input-bordered input-sm font-mono"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="Code from SMS or call"
                        disabled={verifyMutation.isPending}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={verifyMutation.isPending || otpCode.trim().length < 4}
                      onClick={() => {
                        setLocalError(null);
                        verifyMutation.mutate();
                      }}
                    >
                      {verifyMutation.isPending ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Verifying…
                        </>
                      ) : (
                        "Verify number"
                      )}
                    </button>
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {showComplete ? (
              <div className="space-y-2">
                <div role="alert" className="alert alert-success alert-soft">
                  <span>This number completed Meta verification for Cloud API.</span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ensureMutation.isPending}
                  onClick={() => {
                    setLocalError(null);
                    ensureMutation.mutate();
                  }}
                >
                  {ensureMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      Working…
                    </>
                  ) : (
                    "Ensure webhook subscription"
                  )}
                </button>
              </div>
            ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
