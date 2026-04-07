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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [agreeToLegal, setAgreeToLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("error");
    if (err) {
      setError(err.length > 280 ? `${err.slice(0, 280)}…` : err);
      window.history.replaceState(null, "", "/register");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!agreeToLegal) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    startTransition(async () => {
      const result = await registerAction(email, password, workspace);
      if (!result.success) {
        setError(result.error || "Registration failed. Please try again.");
      } else {
        setVerificationSentTo(result.email);
      }
    });
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
              <h1 className="text-xl font-medium">Create account</h1>
              <p className="text-sm text-base-content/70">
                Set up your workspace and start collaborating.
              </p>
            </div>

            {verificationSentTo ? (
              <div className="rounded-box border border-success/30 bg-success/10 px-4 py-4 space-y-3 text-left">
                <p className="text-sm font-medium text-success">
                  Check your email
                </p>
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
                  onClick={() => router.push("/login")}
                >
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
            <div className="space-y-3">
              <GoogleSignInButton label="Sign up with Google" />
              <p className="text-xs text-base-content/60 text-center">
                Google confirms your address — no separate verification email from us.
              </p>
              <div className="divider text-xs text-base-content/50">
                or register with email and password
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
                  placeholder="Enter a secure password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-base-content/70">
                  Workspace name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Product team"
                  className="input input-bordered w-full"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  required
                />
                <p className="text-xs text-base-content/60">
                  This helps organize projects and members.
                </p>
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
                  onClick={() => router.push("/login")}
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
              </>
            )}
          </div>

          <div className="hidden md:flex flex-col justify-between bg-base-200 p-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Preview
              </p>
              <h2 className="text-base font-medium text-base-content">
                {registerFeatureSlides[activeSlide].title}
              </h2>
              <p className="text-sm text-base-content/60">
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
                  className={`h-1.5 w-6 rounded-full transition-all duration-150 ${
                    idx === activeSlide ? "bg-primary" : "bg-base-300"
                  }`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
              <div className="ml-auto text-xs text-base-content/50">
                {activeSlide + 1} / {registerFeatureSlides.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
