"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MeResponse } from "@/lib/api";
import { getAppNav, isActivePath } from "@/lib/navigation";

function closeDrawer(drawerId: string) {
  (document.getElementById(drawerId) as HTMLInputElement | null)?.click();
}

const ACTIVE_CLASS =
  "bg-base-200 text-base-content border border-base-300 font-medium";
const INACTIVE_CLASS =
  "text-base-content/70 hover:bg-base-200/60 hover:text-base-content border border-transparent";

export function Sidebar({
  drawerId,
  me,
}: {
  drawerId: string;
  me: MeResponse;
}) {
  const pathname = usePathname();
  const nav = getAppNav(me.platformRole ?? "NONE");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  const workspaceInitials = me.workspace.name.slice(0, 2).toUpperCase();
  const userInitials = me.user.email.slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col border-r border-base-300 bg-base-100">
      {/* Workspace header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-base-300 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <span className="text-xs font-bold text-primary">{workspaceInitials}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-base-content">
            {me.workspace.name}
          </p>
          <p className="text-xs text-base-content/50 capitalize">
            {String(me.role).toLowerCase()}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
        aria-label="Main navigation"
      >
        <ul className="flex flex-col gap-0.5">
          {nav.map(({ href, label, Icon, children }) => {
            const isParentActive = isActivePath(pathname, href);
            const isAnyChildActive =
              children?.some((child) => isActivePath(pathname, child.href)) ?? false;

            if (!children?.length) {
              if (!Icon) return null;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => closeDrawer(drawerId)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isParentActive ? ACTIVE_CLASS : INACTIVE_CLASS
                      }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            }

            const defaultOpen = isParentActive || isAnyChildActive;
            const isOpen = groupOpen[href] ?? defaultOpen;
            if (!Icon) return null;

            return (
              <li key={href}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setGroupOpen((prev) => ({
                      ...prev,
                      [href]: !(prev[href] ?? defaultOpen),
                    }))
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isParentActive && !isAnyChildActive ? ACTIVE_CLASS : INACTIVE_CLASS
                    }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 text-base-content/40 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isOpen ? (
                  <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-base-300 pl-3">
                    {children.map((child) => {
                      const childActive = isActivePath(pathname, child.href);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => closeDrawer(drawerId)}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${childActive ? ACTIVE_CLASS : INACTIVE_CLASS
                              }`}
                          >
                            <child.Icon className="h-4 w-4 shrink-0" />
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-base-300 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <span className="text-xs font-semibold text-primary">{userInitials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-base-content">
              {me.user.email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
