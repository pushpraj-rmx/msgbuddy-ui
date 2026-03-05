"use client";

import { useRouter } from "next/navigation";
import type { MeResponse } from "@/lib/api";
import { logoutAction } from "@/app/actions/auth";
import { clearToken } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({
  drawerId,
  me,
}: {
  drawerId: string;
  me: MeResponse;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    clearToken();
    await logoutAction();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300 bg-base-100 px-3 shadow-sm sm:px-4">
      <label
        htmlFor={drawerId}
        className="btn btn-ghost btn-square drawer-button lg:hidden"
        aria-label="open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
      </label>
      <div className="flex flex-1 items-center gap-2">
        <div className="hidden text-sm font-medium text-base-content sm:block">
          {me.workspace.name}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle avatar placeholder"
            aria-label="User menu"
          >
            <div className="bg-primary/20 text-primary w-9 rounded-full">
              <span className="text-xs font-semibold">
                {me.user.email.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </button>
          <ul
            tabIndex={0}
            className="menu dropdown-content z-1 mt-2 w-56 rounded-box bg-base-100 p-2 shadow"
          >
            <li className="menu-title">
              <span className="truncate">{me.user.email}</span>
            </li>
            <li>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
