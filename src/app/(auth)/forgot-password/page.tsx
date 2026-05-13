"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(email);
      if (!result.success) {
        setError(result.error || "Something went wrong.");
        return;
      }
      setDone(true);
    });
  };

  return (
    <div className="min-h-screen bg-base-100 p-6 grid place-items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center">
          <BrandLogo className="h-7 w-auto" priority />
        </div>
        <div className="space-y-1.5">
          <span className="op-label">Account recovery</span>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Forgot password</h1>
          <p className="text-[13px] text-base-content/65">
            If an account exists with this email and uses a password, we will
            send a reset link.
          </p>
        </div>

        {done ? (
          <div
            role="status"
            className="rounded-box border-l-2 border border-success/30 border-l-success bg-base-200 px-4 py-3"
          >
            <span className="op-label mb-1 block text-success">reset link sent</span>
            <p className="text-[13px] text-base-content">
              If we found a matching account, check your inbox for a reset link.
              It expires in one hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <ErrorState message={error} /> : null}
            <label className="form-control w-full">
              <span className="label-text text-sm">Email</span>
              <input
                type="email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link href="/login" className="link link-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
