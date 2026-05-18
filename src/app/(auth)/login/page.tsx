"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { loginAction, resendVerificationAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const loginFeatureSlides = [
  {
    title: "Centralize conversations",
    description:
      "Keep every discussion with agents and teammates in one searchable place.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-1/640/420",
    imageAlt: "Centralized conversations illustration",
  },
  {
    title: "Move faster with context",
    description:
      "See history, metadata, and status in one calm, structured workspace.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-2/640/420",
    imageAlt: "Contextual workspace illustration",
  },
  {
    title: "Integrations that stay out of the way",
    description:
      "Connect channels and monitor health without UI noise or clutter.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-3/640/420",
    imageAlt: "Integrations illustration",
  },
  {
    title: "Operational clarity",
    description:
      "Work with reliable status, clear actions, and consistent patterns.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-4/640/420",
    imageAlt: "Operational clarity illustration",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    const err = q.get("error");
    if (!err) return null;
    const KNOWN_ERRORS: Record<string, string> = {
      verify_failed:
        "That verification link is invalid or expired. Use \u201cResend verification email\u201d below if you still need to verify.",
      missing_verification_token: "Invalid verification link.",
    };
    window.history.replaceState(null, "", "/login");
    return KNOWN_ERRORS[err] ?? "Something went wrong. Please try again.";
  });
  const [verifiedNotice] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    if (q.get("verified") === "1") {
      window.history.replaceState(null, "", "/login");
      return true;
    }
    return false;
  });
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % loginFeatureSlides.length);
    }, 3500);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(email, password);
      if (!result.success) {
        setError(result.error || "Login failed. Please check your credentials.");
      } else {
        setAccessToken(result.accessToken || null, {
          expiresInSeconds: result.expiresIn,
        });
        router.replace("/dashboard");
      }
    });
  };

  const handleResendVerification = () => {
    setResendMessage(null);
    if (!email.trim()) {
      setResendMessage("Enter your email address first.");
      return;
    }
    setResendPending(true);
    void (async () => {
      const result = await resendVerificationAction(email);
      setResendPending(false);
      if (result.success) {
        setResendMessage(
          "If an account exists for this address and is not verified yet, we sent a new link."
        );
      } else {
        setResendMessage(result.error);
      }
    })();
  };

  return (
    <div className="min-h-screen bg-base-100 p-6 grid place-items-center">
      <div className="w-full max-w-5xl overflow-hidden rounded-box border border-base-300 bg-base-200">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="bg-base-100 p-8 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center">
                <BrandLogo className="h-7 w-auto" priority />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="op-label">Sign in</span>
                <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Welcome back</h1>
              </div>
              <p className="text-[0.8125rem] text-base-content/65">
                Access your workspace and inbox.
              </p>
            </div>

            <div className="space-y-3">
              <GoogleSignInButton />
              <p className="font-mono-op text-[0.625rem] tracking-[0.04em] text-base-content/50 text-center">
                no inbox link required · google handles sign-in
              </p>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-base-300" />
                <span className="op-label">or</span>
                <div className="h-px flex-1 bg-base-300" />
              </div>
            </div>

            {verifiedNotice ? (
              <div
                role="status"
                className="rounded-box border-l-2 border border-success/30 border-l-success bg-base-200 px-4 py-3"
              >
                <span className="op-label mb-1 block text-success">verified</span>
                <p className="text-[0.8125rem] text-base-content">Email verified. You can sign in below.</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? <ErrorState message={error} /> : null}
              <div className="space-y-2">
                <label className="text-sm text-base-content/70">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-base-content/70">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-sm link link-primary"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/register")}
                >
                  Create account
                </button>
              </div>
            </form>

            <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-2">
              <span className="op-label">needs verification?</span>
              <p className="text-[0.75rem] text-base-content/65">
                Registered with email &amp; password but didn&apos;t get a verification
                link? (Google sign-in doesn&apos;t use this.)
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                disabled={resendPending}
                onClick={handleResendVerification}
              >
                {resendPending ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Sending…
                  </>
                ) : (
                  "Resend verification email"
                )}
              </button>
              {resendMessage ? (
                <p className="text-xs text-base-content/70">{resendMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="hidden md:flex flex-col justify-between bg-base-200 p-8">
            <div className="space-y-3">
              <span className="op-label">{String(activeSlide + 1).padStart(2, "0")} · preview</span>
              <h2 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">
                {loginFeatureSlides[activeSlide].title}
              </h2>
              <p className="text-[0.8125rem] text-base-content/60">
                {loginFeatureSlides[activeSlide].description}
              </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-box border border-base-300 bg-base-100">
              <Image
                src={loginFeatureSlides[activeSlide].imageSrc}
                alt={loginFeatureSlides[activeSlide].imageAlt}
                width={640}
                height={420}
                className="h-64 w-full object-cover"
                priority
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              {loginFeatureSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`h-[2px] w-8 transition-colors ${
                    idx === activeSlide ? "bg-primary" : "bg-base-300"
                  }`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
              <div className="font-mono-op ml-auto text-[0.625rem] tabular-nums text-base-content/45">
                {String(activeSlide + 1).padStart(2, "0")} / {String(loginFeatureSlides.length).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
