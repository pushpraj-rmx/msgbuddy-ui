"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  BookOpen,
  Blocks,
  Clock,
  CreditCard,
  KeyRound,
  Layers,
  MessageSquareText,
  Monitor,
  Puzzle,
  Sparkles,
  Trash2,
  User,
  Users,
  Webhook,
  Workflow,
  Building2,
  Lock,
} from "lucide-react";
import { isActivePath } from "@/lib/navigation";

export type SettingsNavGating = {
  canManageSettings: boolean;
  canViewMembers: boolean;
  canManageAutomations: boolean;
  canSeeBilling: boolean;
  canAccessUsage: boolean;
  canDeleteWorkspace: boolean;
};

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  show: boolean;
  danger?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

function buildGroups(g: SettingsNavGating): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Account",
      items: [
        { href: "/settings/account", label: "Profile & security", Icon: User, show: true },
        { href: "/settings/password", label: "Password", Icon: Lock, show: true },
        { href: "/settings/appearance", label: "Appearance", Icon: Monitor, show: true },
      ],
    },
    {
      label: "Workspace",
      items: [
        { href: "/settings/workspace", label: "General", Icon: Building2, show: g.canManageSettings },
        { href: "/settings/features", label: "Features", Icon: Blocks, show: g.canManageSettings },
        { href: "/settings/team", label: "Team & roles", Icon: Users, show: g.canViewMembers },
        { href: "/billing", label: "Billing & plan", Icon: CreditCard, show: g.canSeeBilling },
        { href: "/usage", label: "Usage", Icon: Layers, show: g.canAccessUsage },
      ],
    },
    {
      label: "Channels",
      items: [
        { href: "/settings/integrations", label: "Integrations", Icon: Puzzle, show: g.canManageSettings },
      ],
    },
    {
      label: "Inbox",
      items: [
        { href: "/settings/canned-responses", label: "Canned responses", Icon: MessageSquareText, show: true },
        { href: "/settings/automations", label: "Automations", Icon: Workflow, show: g.canManageAutomations },
        { href: "/settings/business-hours", label: "Business hours", Icon: Clock, show: g.canManageAutomations },
      ],
    },
    {
      label: "AI Assistant",
      items: [
        { href: "/settings/chatbot", label: "Chatbot", Icon: Sparkles, show: g.canManageSettings },
        { href: "/settings/knowledge", label: "Knowledge base", Icon: BookOpen, show: true },
      ],
    },
    {
      label: "Developers",
      items: [
        { href: "/settings/developers", label: "API keys", Icon: KeyRound, show: g.canManageSettings },
        { href: "/settings/webhooks", label: "Webhooks", Icon: Webhook, show: g.canManageSettings },
      ],
    },
    {
      label: "",
      items: [
        { href: "/settings/danger", label: "Danger zone", Icon: Trash2, show: g.canDeleteWorkspace, danger: true },
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((i) => i.show) }))
    .filter((group) => group.items.length > 0);
}

export function SettingsNav({ gating }: { gating: SettingsNavGating }) {
  const pathname = usePathname();
  const groups = buildGroups(gating);

  return (
    <nav
      aria-label="Settings"
      className="w-full shrink-0 lg:w-56"
    >
      <ul className="menu menu-sm w-full gap-0.5 p-0">
        {groups.map((group, gi) => (
          <li key={group.label || `group-${gi}`}>
            {group.label ? (
              <span className="op-label pointer-events-none px-2 pb-1 pt-3">
                {group.label}
              </span>
            ) : (
              <div className="my-1 border-t border-base-300" role="presentation" />
            )}
            <ul className="gap-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`gap-2.5 ${
                        active ? "active font-medium" : ""
                      } ${item.danger ? "text-error hover:bg-error/10" : ""}`}
                    >
                      <item.Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {item.label}
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
