import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Bell,
  CreditCard,
  FileText,
  Home,
  Image,
  Layers,
  ListChecks,
  MessageSquare,
  Rocket,
  Settings,
  Terminal,
  Users,
} from "lucide-react";
import { canAccessPlatform, isSuperAdmin } from "@/lib/platform-access";
import {
  canAccessBillingPage,
  canAccessCampaigns,
  canAccessUsagePage,
  canViewTemplates,
} from "@/lib/workspace-access";

type NavIcon = ComponentType<LucideProps>;

export type AppNavItem = {
  href: string;
  label: string;
  Icon: NavIcon;
  showInDock?: boolean;
  children?: Array<{ href: string; label: string; Icon: NavIcon }>;
};

export function getAppNav(
  platformRole: string,
  workspaceRole?: string,
): AppNavItem[] {
  const items: AppNavItem[] = [
    { href: "/dashboard", label: "Dashboard", Icon: Home, showInDock: true },
    { href: "/inbox", label: "Inbox", Icon: MessageSquare, showInDock: true },
    {
      href: "/people/contacts",
      label: "People",
      Icon: Users,
      showInDock: true,
    },
    { href: "/campaigns", label: "Campaigns", Icon: Rocket, showInDock: true },
    { href: "/templates", label: "Templates", Icon: FileText, showInDock: true },
    { href: "/tasks", label: "Tasks", Icon: ListChecks },
    { href: "/media", label: "Media", Icon: Image },
    { href: "/notifications", label: "Notifications", Icon: Bell },
    // Feedback / bug report — surfaced as a topbar button (see Topbar.tsx) so
    // agents can report from anywhere in the app, not just from the sidebar.
    { href: "/usage", label: "Usage", Icon: Layers },
    { href: "/billing", label: "Billing", Icon: CreditCard },
    {
      href: "/settings",
      label: "Settings",
      Icon: Settings,
    },
  ];

  if (canAccessPlatform(platformRole)) {
    items.push({ href: "/platform", label: "Platform", Icon: Terminal });
    items.push({ href: "/ops", label: "Ops", Icon: Terminal });
  }
  if (isSuperAdmin(platformRole)) {
    items.push({ href: "/onboarding", label: "Onboarding", Icon: Terminal });
  }

  const wr = workspaceRole;
  if (wr != null && wr !== "") {
    return items.filter((item) => {
      if (item.href === "/campaigns" && !canAccessCampaigns(wr)) return false;
      if (item.href === "/templates" && !canViewTemplates(wr)) return false;
      if (item.href === "/usage" && !canAccessUsagePage(wr)) return false;
      if (item.href === "/billing" && !canAccessBillingPage(wr)) return false;
      return true;
    });
  }

  return items;
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/people/contacts")) return "Contacts";
  if (pathname.startsWith("/campaigns/new")) return "New campaign";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/media")) return "Media";
  if (pathname.startsWith("/settings/integrations/whatsapp")) return "WhatsApp";
  if (pathname.startsWith("/settings/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/team")) return "Team";
  if (pathname.startsWith("/settings/password")) return "Password";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/platform")) return "Platform";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/feedback")) return "Feedback";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/usage")) return "Usage";
  return "MsgBuddy";
}
