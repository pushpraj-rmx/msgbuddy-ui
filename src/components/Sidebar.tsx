"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  TagIcon,
  Squares2X2Icon,
  RocketLaunchIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
  ChartBarIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  CommandLineIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import type { MeResponse } from "@/lib/api";
import { logoutAction } from "@/app/actions/auth";
import { clearToken } from "@/lib/auth";
import { canAccessPlatform, isSuperAdmin } from "@/lib/platform-access";

function closeDrawer(drawerId: string) {
  (document.getElementById(drawerId) as HTMLInputElement | null)?.click();
}

function getNav(platformRole: string) {
  const items = [
    { href: "/dashboard", label: "Dashboard", Icon: HomeIcon },
    { href: "/inbox", label: "Inbox", Icon: ChatBubbleLeftRightIcon },
    { href: "/contacts", label: "Contacts", Icon: UserGroupIcon },
    { href: "/contacts/tags", label: "Tags", Icon: TagIcon },
    { href: "/contacts/segments", label: "Segments", Icon: Squares2X2Icon },
    { href: "/campaigns", label: "Campaigns", Icon: RocketLaunchIcon },
    { href: "/templates", label: "Templates", Icon: DocumentDuplicateIcon },
    { href: "/media", label: "Media", Icon: PhotoIcon },
    { href: "/analytics", label: "Analytics", Icon: ChartBarIcon },
    { href: "/usage", label: "Usage", Icon: CircleStackIcon },
    { href: "/settings", label: "Settings", Icon: Cog6ToothIcon },
  ];

  if (canAccessPlatform(platformRole)) {
    items.push({ href: "/platform", label: "Platform", Icon: CommandLineIcon });
    items.push({ href: "/ops", label: "Ops", Icon: CommandLineIcon });
  }
  if (isSuperAdmin(platformRole)) {
    items.push({
      href: "/onboarding",
      label: "Onboarding",
      Icon: BuildingOffice2Icon,
    });
  }

  return items;
}

export function Sidebar({
  drawerId,
  me,
}: {
  drawerId: string;
  me: MeResponse;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = getNav(me.platformRole ?? "NONE");

  const handleLogout = async () => {
    clearToken();
    await logoutAction();
    router.replace("/login");
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-base-300 bg-base-200 shadow-md lg:w-64">
      <div className="flex h-14 shrink-0 items-center border-b border-base-300 px-4">
        <Link
          href="/dashboard"
          className="btn btn-ghost flex items-center gap-2 text-xl font-semibold text-primary"
          onClick={() => closeDrawer(drawerId)}
        >
          MsgBuddy
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="menu menu-vertical w-full gap-1 rounded-box p-0">
          {nav.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => closeDrawer(drawerId)}
                className={`flex items-center gap-3 rounded-xl ${pathname === href ? "menu-active bg-primary text-primary-content shadow-sm" : ""}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-base-300 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder shrink-0">
            <div className="bg-primary/20 text-primary w-10 rounded-full">
              <span className="text-sm font-medium">
                {me.user.email.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-base-content">
              {me.user.email}
            </p>
            <p className="truncate text-xs text-base-content/60">
              {me.workspace.name}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-ghost btn-sm flex h-auto items-center gap-1.5 p-0 text-base-content/70"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}


