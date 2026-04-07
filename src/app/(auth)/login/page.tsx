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
  const [error, setError] = useState<string | null>(null);
  const [verifiedNotice, setVerifiedNotice] = useState(false);
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

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("verified") === "1") {
      setVerifiedNotice(true);
      window.history.replaceState(null, "", "/login");
    }
    const err = q.get("error");
    if (err) {
      const KNOWN_ERRORS: Record<string, string> = {
        verify_failed:
          "That verification link is invalid or expired. Use \u201cResend verification email\u201d below if you still need to verify.",
        missing_verification_token: "Invalid verification link.",
      };
      setError(KNOWN_ERRORS[err] ?? "Something went wrong. Please try again.");
      window.history.replaceState(null, "", "/login");
    }
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
      <div className="w-full max-w-5xl overflow-hidden rounded-box border border-base-300 bg-base-100">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="bg-base-100 p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center">
                <BrandLogo className="h-7 w-auto" priority />
              </div>
              <h1 className="text-xl font-medium">Sign in</h1>
              <p className="text-sm text-base-content/70">
                Access your workspace and inbox.
              </p>
            </div>

            <div className="space-y-3">
              <GoogleSignInButton />
              <p className="text-xs text-base-content/60 text-center">
                No inbox link required — Google handles sign-in.
              </p>
              <div className="divider text-xs text-base-content/50">or</div>
            </div>

            {verifiedNotice ? (
              <div
                role="status"
                className="rounded-box border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
              >
                Email verified. You can sign in below.
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

            <div className="rounded-box border border-base-300 bg-base-200/50 p-4 space-y-2">
              <p className="text-xs font-medium text-base-content/70">
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

          <div className="hidden md:flex flex-col justify-between bg-base-200 p-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Preview
              </p>
              <h2 className="text-base font-medium text-base-content">
                {loginFeatureSlides[activeSlide].title}
              </h2>
              <p className="text-sm text-base-content/60">
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
                  className={`h-1.5 w-6 rounded-full transition-all duration-150 ${
                    idx === activeSlide ? "bg-primary" : "bg-base-300"
                  }`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
              <div className="ml-auto text-xs text-base-content/50">
                {activeSlide + 1} / {loginFeatureSlides.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
