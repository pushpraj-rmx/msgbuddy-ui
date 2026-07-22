"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  LifeBuoy,
  Send,
  Webhook,
  Activity,
  ScrollText,
  Radio,
  Briefcase,
  Rocket,
  ServerCog,
  Search,
  SatelliteDish,
  AlertTriangle,
} from "lucide-react";
import { isActivePath } from "@/lib/navigation";
import { isSuperAdmin } from "@/lib/platform-access";
import type { PlatformRole } from "@/lib/types";
import { usePlatformAccessRequestsOpenCount } from "@/hooks/use-platform";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  show: boolean;
  /** Match only the exact path (used for the section root). */
  exact?: boolean;
  /** Query hook key for a count badge. */
  badge?: "accessRequests";
};

type NavGroup = { label: string; items: NavItem[] };

function buildGroups(superAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "",
      items: [
        { href: "/platform", label: "Overview", Icon: LayoutDashboard, show: true, exact: true },
      ],
    },
    {
      label: "Tenants",
      items: [
        { href: "/platform/workspaces", label: "Workspaces", Icon: Building2, show: true },
        { href: "/platform/users", label: "Users", Icon: Users, show: true },
        {
          href: "/platform/access-requests",
          label: "Access requests",
          Icon: LifeBuoy,
          show: true,
          badge: "accessRequests",
        },
      ],
    },
    {
      label: "Logs",
      items: [
        { href: "/platform/logs/failed-sends", label: "Failed sends", Icon: Send, show: true },
        { href: "/platform/logs/webhooks", label: "Webhook logs", Icon: Webhook, show: true },
        { href: "/platform/logs/usage", label: "Usage events", Icon: Activity, show: true },
        { href: "/platform/logs/audit", label: "Audit log", Icon: ScrollText, show: true },
      ],
    },
    {
      label: "Observability",
      items: [
        { href: "/platform/observability", label: "Search / trace", Icon: Search, show: true, exact: true },
        { href: "/platform/observability/webhooks", label: "Webhook inspector", Icon: Webhook, show: true },
        { href: "/platform/observability/provider-requests", label: "Provider calls", Icon: SatelliteDish, show: true },
        { href: "/platform/observability/failures", label: "Failure center", Icon: AlertTriangle, show: true },
      ],
    },
    {
      label: "Channels",
      items: [
        { href: "/platform/channels", label: "Channel accounts", Icon: Radio, show: superAdmin },
        { href: "/platform/client-businesses", label: "Client businesses", Icon: Briefcase, show: superAdmin },
        { href: "/platform/onboarding", label: "Onboarding", Icon: Rocket, show: superAdmin },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/platform/ops", label: "Ops queues", Icon: ServerCog, show: true },
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((i) => i.show) }))
    .filter((group) => group.items.length > 0);
}

export function PlatformNav({ platformRole }: { platformRole: PlatformRole | string }) {
  const pathname = usePathname();
  const groups = buildGroups(isSuperAdmin(platformRole));
  const openRequests = usePlatformAccessRequestsOpenCount();
  const openCount = openRequests.data?.count ?? 0;

  return (
    <nav aria-label="Platform" className="w-full shrink-0 lg:w-56">
      <ul className="menu menu-sm w-full gap-0.5 p-0">
        {groups.map((group, gi) => (
          <li key={group.label || `group-${gi}`}>
            {group.label ? (
              <span className="op-label pointer-events-none px-2 pb-1 pt-3">{group.label}</span>
            ) : null}
            <ul className="gap-0.5">
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`gap-2.5 ${active ? "active font-medium" : ""}`}
                    >
                      <item.Icon className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge === "accessRequests" && openCount > 0 ? (
                        <span className="badge badge-primary badge-sm">{openCount}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
