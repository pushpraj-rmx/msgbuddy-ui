"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const registerFeatureSlides = [
  {
    title: "Get a workspace in minutes",
    description:
      "Create your workspace and start organizing conversations immediately.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-1/640/420",
    imageAlt: "Workspace setup illustration",
  },
  {
    title: "Stay consistent as you grow",
    description:
      "Predictable structure, clear actions, and calm defaults everywhere.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-2/640/420",
    imageAlt: "Consistency illustration",
  },
  {
    title: "Keep integrations tidy",
    description:
      "Connect channels with clear status and minimal operational overhead.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-3/640/420",
    imageAlt: "Integrations illustration",
  },
  {
    title: "Focus on the work",
    description:
      "A clean inbox experience with the details you need, when you need them.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-4/640/420",
    imageAlt: "Inbox illustration",
  },
] as const;

/** Same-origin-pathname allowlist for `?next=` — see login/page.tsx for context. */
function safeNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  // Capture `?next=` first — the error initializer below replaceStates the URL.
  const [nextPath] = useState<string | null>(() => safeNextPath());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToLegal, setAgreeToLegal] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    const err = q.get("error");
    if (!err) return null;
    window.history.replaceState(null, "", "/register");
    return err.length > 280 ? `${err.slice(0, 280)}…` : err;
  });
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % registerFeatureSlides.length);
    }, 3500);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!agreeToLegal) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      return;
    }
    startTransition(async () => {
      const result = await registerAction(email, password);
      if (!result.success) {
        setError(result.error || "Registration failed. Please try again.");
      } else {
        setVerificationSentTo(result.email);
      }
    });
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
                <span className="op-label">Register</span>
                <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Create your account</h1>
              </div>
              <p className="text-[0.8125rem] text-base-content/65">
                We&apos;ll create your workspace automatically — you can rename it
                anytime in settings.
              </p>
            </div>

            {verificationSentTo ? (
              <div className="rounded-box border-l-2 border border-success/30 border-l-success bg-base-200 px-4 py-4 space-y-3 text-left">
                <span className="op-label text-success">check your email</span>
                <p className="text-sm text-base-content/80">
                  We sent a verification link to{" "}
                  <span className="font-medium text-base-content">
                    {verificationSentTo}
                  </span>
                  . Open it to confirm you own this address, then sign in with
                  your password. Until you verify, password sign-in is blocked
                  (Google sign-in is separate and doesn&apos;t use this step).
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => router.push(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login")}
                >
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
            <div className="space-y-3">
              <GoogleSignInButton label="Sign up with Google" />
              <p className="font-mono-op text-[0.625rem] tracking-[0.04em] text-base-content/50 text-center">
                google confirms your address · no separate verification email from us
              </p>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-base-300" />
                <span className="op-label whitespace-nowrap">or · email &amp; password</span>
                <div className="h-px flex-1 bg-base-300" />
              </div>
            </div>

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
                <label className="text-sm text-base-content/70">Password</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Enter a secure password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <p className="text-xs text-base-content/60">
                  At least 6 characters.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-base-content/70">
                  Confirm password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className="input input-bordered w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-box bg-base-100 px-4 py-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm rounded-full mt-0.5"
                  checked={agreeToLegal}
                  onChange={(e) => setAgreeToLegal(e.target.checked)}
                  required
                />
                <span className="text-sm text-base-content/70">
                  I agree to the{" "}
                  <Link href="/terms" className="link link-hover">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="link link-hover">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isPending || !agreeToLegal}
                >
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login")}
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
              </>
            )}
          </div>

          <div className="hidden md:flex flex-col justify-between bg-base-200 p-8">
            <div className="space-y-3">
              <span className="op-label">{String(activeSlide + 1).padStart(2, "0")} · preview</span>
              <h2 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">
                {registerFeatureSlides[activeSlide].title}
              </h2>
              <p className="text-[0.8125rem] text-base-content/60">
                {registerFeatureSlides[activeSlide].description}
              </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-box border border-base-300 bg-base-100">
              <Image
                src={registerFeatureSlides[activeSlide].imageSrc}
                alt={registerFeatureSlides[activeSlide].imageAlt}
                width={640}
                height={420}
                className="h-64 w-full object-cover"
                priority
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              {registerFeatureSlides.map((_, idx) => (
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
                {String(activeSlide + 1).padStart(2, "0")} / {String(registerFeatureSlides.length).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
