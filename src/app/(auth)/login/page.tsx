"use client";

import { useEffect, useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";

const loginFeatureSlides = [
  {
    title: "Centralize conversations",
    description:
      "Keep every discussion with agents and teammates in one searchable place.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-1/400/240",
    imageAlt: "Centralized conversations illustration",
  },
  {
    title: "Integrate your tools",
    description:
      "Plug msgbuddy into your existing stack to automate status updates and handoffs.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-2/400/240",
    imageAlt: "Integrations illustration",
  },
  {
    title: "Ship faster together",
    description:
      "Share prompts, workflows, and insights so your whole team benefits from AI.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-3/400/240",
    imageAlt: "Team shipping faster illustration",
  },
  {
    title: "Always in sync",
    description:
      "Log in from anywhere and pick up every thread exactly where you left it.",
    imageSrc: "https://picsum.photos/seed/msgbuddy-login-4/400/240",
    imageAlt: "Always in sync illustration",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % loginFeatureSlides.length);
    }, 2000);
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
                Let&apos;s log in to your account.
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
                  placeholder="Enter your password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="mt-2 flex items-center justify-between text-xs text-base-content/70">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="checkbox checkbox-xs" />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="link link-primary text-xs"
                  >
                    Forgot password?
                  </button>
                </div>
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
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost border border-base-300 w-full"
                  onClick={() => {
                    window.location.href = "/register";
                  }}
                >
                  Create a new account
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
                  Connect your team, tools, and AI agents in one focused
                  workspace.
                </p>
              </div>

              <div className="carousel w-full">
                <div className="carousel-item w-full">
                  <div className="card w-full bg-primary/20 shadow-sm">
                    <figure className="px-4 pt-4">
                      <img
                        src={loginFeatureSlides[activeSlide].imageSrc}
                        alt={loginFeatureSlides[activeSlide].imageAlt}
                        className="w-full rounded-xl object-cover"
                      />
                    </figure>
                    <div className="card-body">
                      <h3 className="card-title text-base">
                        {loginFeatureSlides[activeSlide].title}
                      </h3>
                      <p className="text-xs opacity-90">
                        {loginFeatureSlides[activeSlide].description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {loginFeatureSlides.map((_, index) => (
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
