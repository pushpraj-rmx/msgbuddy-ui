"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPasswordAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";
import { ErrorState } from "@/components/ui/states";

export function SetPasswordClient() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      return;
    }
    startTransition(async () => {
      const result = await setPasswordAction(newPassword);
      if (!result.success) {
        setError(result.error || "Could not set password.");
        return;
      }
      setOk(true);
      setNewPassword("");
      setConfirmPassword("");
      if (result.accessToken) {
        setAccessToken(result.accessToken, {
          expiresInSeconds: result.expiresIn,
        });
      }
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link href="/settings" className="btn btn-ghost btn-sm -ml-2 gap-1">
        ← Settings
      </Link>

      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
        <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3">
          {error ? <ErrorState message={error} /> : null}
          {ok ? (
            <div
              role="status"
              className="rounded-box border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            >
              Password saved. You can now sign in with email and password on any
              device. Other sessions were signed out; you stay signed in here.
            </div>
          ) : null}
          <label className="form-control w-full">
            <span className="label-text text-sm">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              className="input input-bordered w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
            <span className="label-text-alt text-base-content/50">
              At least 6 characters.
            </span>
          </label>
          <label className="form-control w-full">
            <span className="label-text text-sm">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              className="input input-bordered w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Saving…
              </>
            ) : (
              "Save password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
