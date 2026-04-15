"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MeResponse } from "@/lib/api";
import { getAppNav, isActivePath } from "@/lib/navigation";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";

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
  const nav = getAppNav(me.platformRole ?? "NONE", String(me.role));
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col border-r border-base-300 bg-base-100">
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
                    className={`flex items-center gap-3 rounded-box px-3 py-2 text-sm transition-colors ${isParentActive ? ACTIVE_CLASS : INACTIVE_CLASS
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
                  className={`flex w-full items-center gap-3 rounded-box px-3 py-2 text-sm transition-colors ${isParentActive && !isAnyChildActive ? ACTIVE_CLASS : INACTIVE_CLASS
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
                            className={`flex items-center gap-2.5 rounded-box px-2.5 py-1.5 text-sm transition-colors ${childActive ? ACTIVE_CLASS : INACTIVE_CLASS
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

      {/* Workspace switcher — bottom of sidebar */}
      <div className="shrink-0 border-t border-base-300 p-3">
        <p className="mb-1.5 text-xs font-medium text-base-content/60">Workspace</p>
        <WorkspaceSwitcher
          currentWorkspaceId={me.workspace.id}
          currentName={me.workspace.name}
        />
        <p className="mt-2 truncate text-xs text-base-content/50 capitalize">
          {String(me.role).toLowerCase()}
        </p>
      </div>
    </aside>
  );
}
