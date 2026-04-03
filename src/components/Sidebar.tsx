"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MeResponse } from "@/lib/api";
import { SAMPLE_OVERFLOW_MENU_ITEMS } from "@/lib/sample-overflow-menu";
import { getAppNav, isActivePath } from "@/lib/navigation";

function closeDrawer(drawerId: string) {
  (document.getElementById(drawerId) as HTMLInputElement | null)?.click();
}

const ACTIVE_ITEM_CLASS =
  "menu-active bg-base-200 text-base-content border border-base-300 shadow-none";

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

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col border-r border-base-300 bg-base-100 lg:w-64">
      <nav className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="space-y-4">
          <ul className="menu menu-vertical w-full gap-1.5 rounded-box p-0">
            {nav.map(({ href, label, Icon, children }) => {
            const isParentActive = isActivePath(pathname, href);
            const isAnyChildActive =
              children?.some((child) => isActivePath(pathname, child.href)) ??
              false;

            if (!children?.length) {
              if (!Icon) return null;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => closeDrawer(drawerId)}
                    className={`flex items-center gap-3 rounded-box py-2.5 ${
                      isParentActive
                        ? ACTIVE_ITEM_CLASS
                        : ""
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            }

            // Nested group (People -> Tags/Segments)
            if (!Icon) return null;
            const defaultOpen = isParentActive || isAnyChildActive;
            const isOpen = groupOpen[href] ?? defaultOpen;
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
                  className={`flex items-center gap-3 rounded-box py-2.5 ${
                    isParentActive
                      ? ACTIVE_ITEM_CLASS
                      : ""
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </button>
                {isOpen ? (
                  <ul className="mt-1 border-l border-base-300 pl-3">
                    {children.map((child) => {
                      const childActive = isActivePath(pathname, child.href);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => closeDrawer(drawerId)}
                            className={`flex items-center gap-3 rounded-box py-2 ${
                              childActive
                                ? ACTIVE_ITEM_CLASS
                                : isAnyChildActive
                                  ? "text-base-content/80"
                                  : "text-base-content/60"
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
          <div className="border-t border-base-300 pt-3">
            <p className="mb-2 text-xs font-medium text-base-content/60">
              Sample menus (overflow test)
            </p>
            <ul className="menu menu-sm menu-vertical w-full rounded-box border border-base-300 bg-base-200 p-0">
              {SAMPLE_OVERFLOW_MENU_ITEMS.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    className="rounded-none text-left text-sm"
                    onClick={() => {}}
                  >
                    <span className="text-base-content/50 tabular-nums">
                      {i + 1}.
                    </span>{" "}
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    </aside>
  );
}


