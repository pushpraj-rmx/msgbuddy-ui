"use client";

import Link from "next/link";
import { Users, Puzzle, Lock, Settings } from "lucide-react";

export function SettingsGearMenu({
  memberCount,
  hasPassword,
  showTeamLink = true,
  showIntegrationsLink = true,
}: {
  memberCount: number;
  hasPassword: boolean;
  showTeamLink?: boolean;
  showIntegrationsLink?: boolean;
}) {
  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        aria-label="Settings menu"
        aria-haspopup="menu"
      >
        <Settings className="text-base-content/80" fontSize="inherit" />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm z-30 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
        role="menu"
      >
        {showTeamLink ? (
          <li role="none">
            <Link
              href="/settings#team-members"
              className="gap-3"
              role="menuitem"
            >
              <Users className="h-4 w-4 shrink-0 opacity-70" fontSize="inherit" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0">
                <span>Team</span>
                <span className="text-xs font-normal text-base-content/50">
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </span>
              </span>
            </Link>
          </li>
        ) : null}
        {showIntegrationsLink ? (
          <li role="none">
            <Link
              href="/settings/integrations"
              className="gap-3"
              role="menuitem"
            >
              <Puzzle
                className="h-4 w-4 shrink-0 opacity-70"
                             />
              Integrations
            </Link>
          </li>
        ) : null}
        <li role="none">
          <Link href="/settings/password" className="gap-3" role="menuitem">
            <Lock className="h-4 w-4 shrink-0 opacity-70" fontSize="inherit" />
            {hasPassword ? "Change password" : "Set password"}
          </Link>
        </li>
      </ul>
    </div>
  );
}
