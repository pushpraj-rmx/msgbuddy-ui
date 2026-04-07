"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changePasswordAction,
  logoutAllAction,
} from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";
import type { LoginHistoryEvent } from "@/lib/api";
import { ErrorState } from "@/components/ui/states";

function formatLoginAction(action: string): string {
  const map: Record<string, string> = {
    LOGIN_SUCCESS: "Signed in",
    LOGIN_FAILED: "Failed sign-in",
    LOGOUT: "Signed out",
    TOKEN_REFRESH: "Session refreshed",
    LOCKOUT: "Account locked",
    PASSWORD_CHANGE: "Password changed",
    PASSWORD_RESET: "Password reset",
  };
  return map[action] ?? action;
}

export function AccountSecurityClient({
  accountEmail,
  hasPassword,
  loginHistory,
}: {
  accountEmail: string;
  hasPassword: boolean;
  loginHistory: LoginHistoryEvent[];
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeOk, setChangeOk] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
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

  const onLogoutAll = () => {
    const ok = window.confirm(
      "Sign out all sessions on every device? You will need to sign in again on this device."
    );
    if (!ok) return;
    setLogoutAllBusy(true);
    void (async () => {
      await logoutAllAction();
      setLogoutAllBusy(false);
      router.replace("/login");
    })();
  };

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-6">
      <div>
        <h2 className="text-base font-medium">Account &amp; security</h2>
        <p className="text-sm text-base-content/70 mt-1">
          Signed in as <span className="font-medium">{accountEmail}</span>
        </p>
      </div>

      {hasPassword ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Change password</h3>
          <form onSubmit={onChangePassword} className="space-y-3 max-w-md">
            {changeError ? <ErrorState message={changeError} /> : null}
            {changeOk ? (
              <div
                role="status"
                className="rounded-box border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
              >
                Password updated. Other sessions were signed out; you stay
                signed in here.
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
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isPending}
            >
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
      ) : (
        <p className="text-sm text-base-content/70 max-w-xl">
          You sign in with Google. Password change is not available for this
          account.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Sessions</h3>
        <p className="text-sm text-base-content/70 max-w-xl">
          Sign out everywhere revokes access on all devices and browsers.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm btn-error"
          disabled={logoutAllBusy}
          onClick={onLogoutAll}
        >
          {logoutAllBusy ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Signing out…
            </>
          ) : (
            "Sign out everywhere"
          )}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Recent sign-in activity</h3>
        {loginHistory.length === 0 ? (
          <p className="text-sm text-base-content/60">No events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-xs">
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="text-sm">
                      {formatLoginAction(row.action)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
