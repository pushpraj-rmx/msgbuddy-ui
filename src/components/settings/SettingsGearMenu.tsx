"use client";

import Link from "next/link";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import IntegrationInstructionsRounded from "@mui/icons-material/IntegrationInstructionsRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

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
        className="btn btn-ghost btn-sm btn-square"
        aria-label="Settings menu"
        aria-haspopup="menu"
      >
        <SettingsRounded className="h-5 w-5 text-base-content/80" fontSize="inherit" />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm z-30 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
        role="menu"
      >
        {showTeamLink ? (
          <li role="none">
            <Link
              href="/settings/team"
              className="gap-3"
              role="menuitem"
            >
              <GroupsRounded className="h-4 w-4 shrink-0 opacity-70" fontSize="inherit" />
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
              <IntegrationInstructionsRounded
                className="h-4 w-4 shrink-0 opacity-70"
                fontSize="inherit"
              />
              Integrations
            </Link>
          </li>
        ) : null}
        <li role="none">
          <Link href="/settings/password" className="gap-3" role="menuitem">
            <LockRounded className="h-4 w-4 shrink-0 opacity-70" fontSize="inherit" />
            {hasPassword ? "Change password" : "Set password"}
          </Link>
        </li>
      </ul>
    </div>
  );
}
