"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/app/actions/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token?.trim()) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const result = await resetPasswordAction(token.trim(), password);
      if (!result.success) {
        setError(result.error || "Could not reset password.");
        return;
      }
      setDone(true);
    });
  };

  if (!token?.trim()) {
    return (
      <div className="space-y-4">
        <ErrorState message="This page needs a reset link from your email (missing token)." />
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="link link-primary">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-box border border-success/30 bg-success/10 px-4 py-3 text-sm text-success space-y-3"
      >
        <p>Your password was updated. You can sign in with your new password.</p>
        <Link href="/login" className="btn btn-primary btn-sm">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      <label className="form-control w-full">
        <span className="label-text text-sm">New password</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text text-sm">Confirm password</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
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
            Saving…
          </>
        ) : (
          "Set new password"
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-base-100 p-6 grid place-items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center">
          <BrandLogo className="h-7 w-auto" priority />
        </div>
        <div>
          <h1 className="text-xl font-medium">Set a new password</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Choose a new password for your account.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
        <p className="text-center text-sm">
          <Link href="/login" className="link link-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
