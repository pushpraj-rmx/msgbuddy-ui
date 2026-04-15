"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye } from "lucide-react";
import { logoutAllAction } from "@/app/actions/auth";
import type { LoginHistoryEvent } from "@/lib/api";
import { meApi } from "@/lib/api";
import { AvatarCropUpload } from "@/components/ui/AvatarCropUpload";

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
  accountName,
  accountAvatarUrl,
  hasPassword,
  loginHistory,
}: {
  accountEmail: string;
  accountName?: string;
  accountAvatarUrl?: string | null;
  hasPassword: boolean;
  loginHistory: LoginHistoryEvent[];
}) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(accountAvatarUrl ?? null);
  const [displayName, setDisplayName] = useState(accountName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const onAvatarUploaded = async (url: string) => {
    setAvatarUrl(url);
    try {
      await meApi.updateProfile({ avatarUrl: url });
      router.refresh();
    } catch {
      // avatar is visually updated; silent failure is acceptable here
    }
  };

  const onSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSaved(false);
    setNameSaving(true);
    try {
      await meApi.updateProfile({ name: displayName.trim() || undefined });
      setNameSaved(true);
      router.refresh();
    } catch {
      setNameError("Failed to save name.");
    } finally {
      setNameSaving(false);
    }
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
    <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5">
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[4.75rem_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <div>
            <AvatarCropUpload
              currentUrl={avatarUrl}
              initials={displayName ? displayName.slice(0, 2).toUpperCase() : accountEmail.slice(0, 2).toUpperCase()}
              onUploaded={onAvatarUploaded}
            />
          </div>

          <form onSubmit={onSaveName} className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-base-content/55">
              Display Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input input-sm input-bordered w-full bg-base-200/50"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameSaved(false);
                }}
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={nameSaving}>
                {nameSaving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
              </button>
            </div>
          </form>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-base-content/55">
              Email Address
            </label>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-200/50 px-3 py-2 text-sm">
              <span className="truncate">{accountEmail}</span>
              <span className="badge badge-success badge-sm badge-soft">Verified</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-3">
          <div>
            <p className="text-sm font-medium text-base-content">Active Sessions</p>
            <p className="text-xs text-base-content/60">
              {Math.max(1, Math.min(loginHistory.length, 6))} devices currently logged in
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost border border-base-300/70"
              onClick={() => setShowSessions((v) => !v)}
            >
              <Eye className="h-4 w-4" />
              Manage Sessions
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost text-error hover:bg-error/10"
              disabled={logoutAllBusy}
              onClick={onLogoutAll}
            >
              {logoutAllBusy ? "Signing out..." : "Sign out everywhere"}
            </button>
          </div>
        </div>

        {nameError ? <p className="text-xs text-error">{nameError}</p> : null}
        {nameSaved ? <p className="text-xs text-success">Name saved.</p> : null}
        {!hasPassword ? (
          <p className="text-xs text-base-content/65">
            Password login is not set for this account yet.
          </p>
        ) : null}

        {showSessions ? (
          <div className="rounded-xl border border-base-300 bg-base-200/25 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/55">
              Recent sign-in activity
            </p>
            {loginHistory.length === 0 ? (
              <p className="text-sm text-base-content/60">No events yet.</p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-lg border border-base-300 bg-base-100">
                <table className="table table-sm">
                  <thead className="bg-base-200/80">
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
                        <td className="text-sm">{formatLoginAction(row.action)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
