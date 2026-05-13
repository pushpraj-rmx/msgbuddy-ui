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
      className="dock dock-sm fixed bottom-0 left-0 right-0 z-30 border-t border-base-300 bg-base-100 pb-[env(safe-area-inset-bottom,0px)] lg:hidden [&>*]:mb-0 [&>*]:relative [&_.dock-label]:font-mono-op [&_.dock-label]:text-[9px] [&_.dock-label]:tracking-[0.14em] [&_.dock-label]:uppercase [&_.dock-active]:before:absolute [&_.dock-active]:before:inset-x-3 [&_.dock-active]:before:top-0 [&_.dock-active]:before:h-[2px] [&_.dock-active]:before:bg-primary [&_.dock-active_svg]:text-primary [&_.dock-active_.dock-label]:text-primary"
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
            <Icon className="h-5 w-5" aria-hidden />
            <span className="dock-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
