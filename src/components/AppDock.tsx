"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAppNav, isActivePath } from "@/lib/navigation";

/** Primary shortcuts on small screens; hidden from `lg` (sidebar + topbar suffice). */
export function AppDock({
  platformRole,
  workspaceRole,
}: {
  platformRole: string;
  workspaceRole?: string;
}) {
  const pathname = usePathname();
  const items = getAppNav(platformRole, workspaceRole).filter(
    (item) => item.showInDock
  );

  return (
    <nav
      className="dock dock-sm fixed bottom-0 left-0 right-0 z-30 border-t border-base-300/80 bg-base-200/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm lg:hidden [&>*]:mb-0"
      aria-label="Primary"
    >
      {items.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "dock-active" : undefined}
          >
            <Icon className="h-6 w-6" aria-hidden />
            <span className="dock-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
