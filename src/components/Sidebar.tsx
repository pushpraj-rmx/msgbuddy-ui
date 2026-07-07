"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MeResponse } from "@/lib/api";
import { getAppNav, isActivePath } from "@/lib/navigation";
import { PanelLeft, PanelRight } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandIcon } from "@/components/BrandIcon";

function closeDrawer(drawerId: string) {
  (document.getElementById(drawerId) as HTMLInputElement | null)?.click();
}

const ACTIVE_CLASS =
  "bg-base-200 text-base-content border border-base-300 font-medium [&_svg]:text-primary";
const INACTIVE_CLASS =
  "text-base-content/65 hover:bg-base-200/60 hover:text-base-content border border-transparent [&_svg]:text-base-content/45";

export function Sidebar({
  drawerId,
  me,
  collapsed = false,
  onToggle,
}: {
  drawerId: string;
  me: MeResponse;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const nav = getAppNav(me.platformRole ?? "NONE", String(me.role), {
    commerceEnabled: me.workspace?.commerceEnabled,
    recurringEnabled: me.workspace?.recurringEnabled,
  });
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-r border-base-300 bg-base-100 transition-[width] duration-200 ${
        collapsed ? "w-16 overflow-visible" : "w-52"
      }`}
    >
      {/* Header: logo + toggle */}
      <div className={`flex min-h-15 shrink-0 items-center border-b border-base-300 ${collapsed ? "justify-center px-3" : "justify-between px-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-1.5">
            <Link href="/dashboard" aria-label="MsgBuddy home">
              <BrandIcon title="MsgBuddy" className="h-8 w-8" />
            </Link>
            {onToggle && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Expand sidebar"
                onClick={onToggle}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Link href="/dashboard" aria-label="MsgBuddy home" className="text-base-content">
              <BrandLogo className="h-7 w-auto" />
            </Link>
            {onToggle && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Collapse sidebar"
                onClick={onToggle}
              >
                <PanelRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav
        className={`min-h-0 flex-1 p-2 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] ${
          collapsed ? "overflow-visible" : "overflow-y-auto"
        }`}
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
                  <div className={collapsed ? "tooltip tooltip-right" : ""} data-tip={collapsed ? label : undefined}>
                    <Link
                      href={href}
                      onClick={() => closeDrawer(drawerId)}
                      className={`flex items-center gap-3 rounded-box px-3 py-2 text-sm transition-colors ${
                        collapsed ? "justify-center px-0" : ""
                      } ${isParentActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {!collapsed && label}
                    </Link>
                  </div>
                </li>
              );
            }

            const defaultOpen = isParentActive || isAnyChildActive;
            const isOpen = groupOpen[href] ?? defaultOpen;
            if (!Icon) return null;

            // Collapsed: show only parent icon, no children
            if (collapsed) {
              return (
                <li key={href}>
                  <div className="tooltip tooltip-right" data-tip={label}>
                    <Link
                      href={href}
                      onClick={() => closeDrawer(drawerId)}
                      className={`flex items-center gap-3 rounded-box px-3 py-2 text-sm transition-colors justify-center px-0 ${
                        isParentActive || isAnyChildActive ? ACTIVE_CLASS : INACTIVE_CLASS
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                    </Link>
                  </div>
                </li>
              );
            }

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
                  className={`flex w-full items-center gap-3 rounded-box px-3 py-2 text-sm transition-colors ${
                    isParentActive && !isAnyChildActive ? ACTIVE_CLASS : INACTIVE_CLASS
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{label}</span>}
                  {!collapsed && (
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
                  )}
                </button>
                {isOpen && !collapsed ? (
                  <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-base-300 pl-3">
                    {children.map((child) => {
                      const childActive = isActivePath(pathname, child.href);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => closeDrawer(drawerId)}
                            className={`flex items-center gap-2.5 rounded-box px-2.5 py-1.5 text-sm transition-colors ${
                              childActive ? ACTIVE_CLASS : INACTIVE_CLASS
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
      <div className="shrink-0 border-t border-base-300 p-2">
        {collapsed ? (
          <div className="tooltip tooltip-right" data-tip={me.workspace.name}>
            <div className="flex items-center justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-base-300 bg-base-200 font-mono-op text-[0.6875rem] font-semibold text-base-content">
                {me.workspace.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="op-label mb-1.5">Workspace</p>
            <WorkspaceSwitcher
              currentWorkspaceId={me.workspace.id}
              currentName={me.workspace.name}
            />
            <p className="op-label mt-2 truncate">
              {String(me.role).toLowerCase()}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
