"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  HomeIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

const items: Array<{
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/dashboard",
    label: "Home",
    Icon: HomeIcon,
    match: (p) => p === "/dashboard" || p === "/",
  },
  {
    href: "/inbox",
    label: "Inbox",
    Icon: ChatBubbleLeftRightIcon,
    match: (p) => p.startsWith("/inbox"),
  },
  {
    href: "/contacts",
    label: "Contacts",
    Icon: UserGroupIcon,
    match: (p) => p.startsWith("/contacts"),
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: Cog6ToothIcon,
    match: (p) => p.startsWith("/settings"),
  },
];

/** Primary shortcuts on small screens; hidden from `lg` (sidebar + topbar suffice). */
export function AppDock() {
  const pathname = usePathname();

  return (
    <nav
      className="dock dock-md fixed bottom-0 left-0 right-0 z-30 border-t border-base-300/80 bg-base-200/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm lg:hidden"
      aria-label="Primary"
    >
      {items.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
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
