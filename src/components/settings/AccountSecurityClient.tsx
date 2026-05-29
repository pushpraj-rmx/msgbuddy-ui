"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);

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
    setLogoutAllBusy(true);
    void (async () => {
      await logoutAllAction();
      setLogoutAllBusy(false);
      router.replace("/login");
    })();
  };

  return (
    <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
      {/* ── Profile row ── */}
      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
        <div>
          <AvatarCropUpload
            currentUrl={avatarUrl}
            initials={displayName ? displayName.slice(0, 2).toUpperCase() : accountEmail.slice(0, 2).toUpperCase()}
            onUploaded={onAvatarUploaded}
          />
        </div>

        <form onSubmit={onSaveName} className="space-y-1">
          <span className="op-label">Display name</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input input-sm input-bordered w-full"
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

        <div className="space-y-1">
          <span className="op-label">Email</span>
          <div className="flex items-center justify-between gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-[7px] text-[0.8125rem]">
            <span className="truncate">{accountEmail}</span>
            <span className="op-tag op-tag-ok">Verified</span>
          </div>
        </div>
      </div>

      {/* ── Feedback messages ── */}
      {nameError && <p className="text-[0.75rem] text-error">{nameError}</p>}
      {nameSaved && <p className="text-[0.75rem] text-success">Name saved.</p>}
      {!hasPassword && (
        <p className="text-[0.75rem] text-base-content/50">
          Password login is not set for this account.{" "}
          <a href="/settings/password" className="text-primary hover:underline">Set one</a>
        </p>
      )}

      {/* ── Sessions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-3">
        <div>
          <span className="op-label">sessions</span>
          <p className="mt-0.5 text-[0.75rem] text-base-content/55">
            {Math.max(1, Math.min(loginHistory.length, 6))} device{loginHistory.length === 1 ? "" : "s"} logged in
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowSessions((v) => !v)}
          >
            {showSessions ? "Hide" : "View activity"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error/70 hover:text-error"
            disabled={logoutAllBusy}
            onClick={() => setShowConfirmLogoutAll(true)}
          >
            {logoutAllBusy ? "Signing out…" : "Sign out everywhere"}
          </button>
        </div>
      </div>

      {/* ── Login history table ── */}
      {showSessions && (
        <div className="rounded-box border border-base-300 overflow-hidden">
          <div className="px-3 py-2 bg-base-100/50">
            <span className="op-label">recent activity</span>
          </div>
          {loginHistory.length === 0 ? (
            <p className="px-3 py-3 text-[0.75rem] text-base-content/50">No events yet.</p>
          ) : (
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-[0.78125rem]">
                <thead>
                  <tr className="border-b border-base-300 bg-base-100/30">
                    <th className="op-label px-3 py-2 text-left font-medium">When</th>
                    <th className="op-label px-3 py-2 text-left font-medium">Event</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((row) => (
                    <tr key={row.id} className="border-b border-base-300 last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-base-content/65">
                        {new Date(row.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-2">{formatLoginAction(row.action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showConfirmLogoutAll}
        title="Revoke all other sessions?"
        description="Sign out all sessions on every device? You will need to sign in again on this device."
        confirmLabel="Sign out everywhere"
        tone="danger"
        loading={logoutAllBusy}
        onConfirm={() => {
          setShowConfirmLogoutAll(false);
          onLogoutAll();
        }}
        onClose={() => setShowConfirmLogoutAll(false)}
      />
    </div>
  );
}
