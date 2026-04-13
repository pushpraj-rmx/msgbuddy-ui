"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAllAction } from "@/app/actions/auth";
import type { LoginHistoryEvent } from "@/lib/api";
import { meApi } from "@/lib/api";
import { AvatarCropUpload } from "@/components/ui/AvatarCropUpload";
import { SettingsGearMenu } from "@/components/settings/SettingsGearMenu";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

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
  memberCount,
  loginHistory,
  meRole,
}: {
  accountEmail: string;
  accountName?: string;
  accountAvatarUrl?: string | null;
  hasPassword: boolean;
  memberCount: number;
  loginHistory: LoginHistoryEvent[];
  meRole: string;
}) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(accountAvatarUrl ?? null);
  const [displayName, setDisplayName] = useState(accountName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  const showTeamLink = roleHasWorkspacePermission(meRole, "members.view");
  const showIntegrationsLink = roleHasWorkspacePermission(meRole, "settings.manage");

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
    <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-base font-medium">Account &amp; security</h2>
        <p className="mt-1 text-sm text-base-content/70">
          Signed in as <span className="font-medium">{accountEmail}</span>
        </p>
      </div>

      <div className="divide-y divide-base-300">
      {/* Profile photo + name */}
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Profile</h3>
          <SettingsGearMenu
            memberCount={memberCount}
            hasPassword={hasPassword}
            showTeamLink={showTeamLink}
            showIntegrationsLink={showIntegrationsLink}
          />
        </div>
        <AvatarCropUpload
          currentUrl={avatarUrl}
          initials={displayName ? displayName.slice(0, 2).toUpperCase() : accountEmail.slice(0, 2).toUpperCase()}
          onUploaded={onAvatarUploaded}
        />
        <form onSubmit={onSaveName} className="flex items-end gap-2 max-w-md">
          <label className="form-control flex-1">
            <span className="label-text text-sm">Display name</span>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false); }}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm mb-0.5" disabled={nameSaving}>
            {nameSaving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
          </button>
        </form>
        {nameError && <p className="text-xs text-error">{nameError}</p>}
        {nameSaved && <p className="text-xs text-success">Name saved.</p>}
        {!hasPassword ? (
          <p className="text-sm text-base-content/70">
            You sign in with Google.{" "}
            <Link href="/settings/password" className="link link-primary">
              Set a password
            </Link>{" "}
            if you want to sign in with email and password too.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 pt-6 pb-6">
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

      <div className="pt-6">
        <details className="group rounded-box border border-base-300 bg-base-200/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-base-content">
            Recent sign-in activity
            {loginHistory.length > 0 ? (
              <span className="ml-2 font-normal text-base-content/60">
                ({loginHistory.length})
              </span>
            ) : null}
          </summary>
          <div className="border-t border-base-300 px-4 pb-4 pt-3">
            {loginHistory.length === 0 ? (
              <p className="text-sm text-base-content/60">No events yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto overflow-x-auto rounded-box border border-base-300 bg-base-100">
                <table className="table table-sm">
                  <thead className="sticky top-0 z-[1] bg-base-200/95 backdrop-blur-sm">
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
        </details>
      </div>
      </div>
    </div>
  );
}
