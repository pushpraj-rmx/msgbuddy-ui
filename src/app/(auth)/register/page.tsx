"use client";

import { useEffect, useState, useTransition } from "react";
import { registerAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";

const registerFeatureSlides = [
  {
    title: "Onboard your team in minutes",
    description:
      "Invite teammates, set up channels, and start collaborating with AI right away.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-1/400/240",
    imageAlt: "Team onboarding illustration",
  },
  {
    title: "Organize by workstreams",
    description:
      "Create dedicated spaces for product, support, and ops so nothing gets lost.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-2/400/240",
    imageAlt: "Organized workstreams illustration",
  },
  {
    title: "Share best-practice prompts",
    description:
      "Save and reuse the prompts and workflows that work best for your team.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-3/400/240",
    imageAlt: "Prompt library illustration",
  },
  {
    title: "Stay aligned as you grow",
    description:
      "Use shared channels and guidelines so new teammates ramp up quickly.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-register-4/400/240",
    imageAlt: "Growing team alignment illustration",
  },
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % registerFeatureSlides.length);
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerAction(email, password, workspace);
      if (!result.success) {
        setError(result.error || "Registration failed. Please try again.");
      } else {
        setAccessToken(result.accessToken || null, {
          expiresInSeconds: result.expiresIn,
        });
        window.location.href = "/dashboard";
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100 px-4">
      <div className="card w-full max-w-5xl bg-base-200 shadow-xl rounded-3xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left form panel */}
          <div className="bg-base-100 px-8 py-10 md:px-10">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome 👋
              </h1>
              <p className="mt-1 text-sm text-base-content/70">
                Let&apos;s get you set up with a new account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div className="form-control">
                <label className="label block mb-1 px-0">
                  <span className="label-text text-sm font-medium">
                    Email address
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label block mb-1 px-0">
                  <span className="label-text text-sm font-medium">
                    Password
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="Enter a secure password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label block mb-1 px-0">
                  <span className="label-text text-sm font-medium">
                    Workspace name
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Product team"
                  className="input input-bordered w-full"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  required
                />
                <span className="mt-1 text-xs text-base-content/60">
                  This helps organize your projects and members.
                </span>
              </div>

              <div className="form-control mt-6 space-y-3">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost border border-base-300 w-full"
                  onClick={() => {
                    window.location.href = "/login";
                  }}
                >
                  Already have an account? Log in
                </button>
              </div>
            </form>
          </div>

          {/* Right features carousel */}
          <div className="hidden md:flex bg-primary text-primary-content px-10 py-10 items-center justify-center">
            <div className="w-full max-w-md">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-content/10">
                    <span className="text-2xl font-bold">M</span>
                  </span>
                  <span className="text-xl font-semibold tracking-tight">
                    msgbuddy
                  </span>
                </div>
                <p className="text-sm opacity-90">
                  Build a workspace that brings your people and agents together.
                </p>
              </div>

              <div className="carousel w-full">
                <div className="carousel-item w-full">
                  <div className="card w-full bg-primary/20 shadow-sm">
                    <figure className="px-4 pt-4">
                      <img
                        src={registerFeatureSlides[activeSlide].imageSrc}
                        alt={registerFeatureSlides[activeSlide].imageAlt}
                        className="w-full rounded-xl object-cover"
                      />
                    </figure>
                    <div className="card-body">
                      <h3 className="card-title text-base">
                        {registerFeatureSlides[activeSlide].title}
                      </h3>
                      <p className="text-xs opacity-90">
                        {registerFeatureSlides[activeSlide].description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {registerFeatureSlides.map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-4 rounded-full transition-all ${
                      index === activeSlide
                        ? "bg-primary-content"
                        : "bg-primary-content/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
