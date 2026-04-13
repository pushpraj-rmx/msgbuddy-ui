"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";
import { ErrorState } from "@/components/ui/states";

export function ChangePasswordClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeOk, setChangeOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeOk(false);
    startTransition(async () => {
      const result = await changePasswordAction(currentPassword, newPassword);
      if (!result.success) {
        setChangeError(result.error || "Could not change password.");
        return;
      }
      setChangeOk(true);
      setCurrentPassword("");
      setNewPassword("");
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
        <form onSubmit={onChangePassword} className="mx-auto max-w-md space-y-3">
          {changeError ? <ErrorState message={changeError} /> : null}
          {changeOk ? (
            <div
              role="status"
              className="rounded-box border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            >
              Password updated. Other sessions were signed out; you stay signed
              in here.
            </div>
          ) : null}
          <label className="form-control w-full">
            <span className="label-text text-sm">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="input input-bordered w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text text-sm">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              className="input input-bordered w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
