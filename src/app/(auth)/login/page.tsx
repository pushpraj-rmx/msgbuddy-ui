"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";

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
