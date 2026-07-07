import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Bell,
  Boxes,
  FileText,
  Home,
  Image,
  Layers,
  ListChecks,
  MessageSquare,
  Package,
  RefreshCw,
  Rocket,
  Settings,
  ShoppingBag,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";
import { canAccessPlatform, isSuperAdmin } from "@/lib/platform-access";
import {
  canAccessCampaigns,
  canAccessCommerce,
  canAccessFlows,
  canAccessRecurring,
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

/** Per-workspace feature toggles that gate optional nav modules. */
export type NavFeatures = {
  commerceEnabled?: boolean;
  recurringEnabled?: boolean;
};

export function getAppNav(
  platformRole: string,
  workspaceRole?: string,
  features?: NavFeatures,
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
    { href: "/subscriptions", label: "Subscriptions", Icon: RefreshCw },
    { href: "/flows", label: "Flows", Icon: Workflow },
    { href: "/templates", label: "Templates", Icon: FileText, showInDock: true },
    {
      href: "/commerce/catalogs",
      label: "Commerce",
      Icon: ShoppingBag,
      children: [
        { href: "/commerce/catalogs", label: "Catalogs", Icon: Boxes },
        { href: "/commerce/products", label: "Products", Icon: Package },
        { href: "/commerce/settings", label: "Settings", Icon: Settings },
      ],
    },
    { href: "/tasks", label: "Tasks", Icon: ListChecks },
    { href: "/media", label: "Media", Icon: Image },
    { href: "/notifications", label: "Notifications", Icon: Bell },
    // Feedback / bug report — surfaced as a topbar button (see Topbar.tsx) so
    // agents can report from anywhere in the app, not just from the sidebar.
    { href: "/usage", label: "Usage", Icon: Layers },
    // Billing intentionally NOT in the sidebar — only OWNER/ADMIN configure
    // it, and they already come to Settings for plan/payment changes. The
    // /billing route still works; Settings exposes a "Manage billing" tile.
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
      if (item.href === "/subscriptions" && (!canAccessRecurring(wr) || !features?.recurringEnabled)) return false;
      if (item.href === "/flows" && !canAccessFlows(wr)) return false;
      if (item.href === "/templates" && !canViewTemplates(wr)) return false;
      if (item.href === "/commerce/catalogs" && (!canAccessCommerce(wr) || !features?.commerceEnabled)) return false;
      if (item.href === "/usage" && !canAccessUsagePage(wr)) return false;
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
  if (pathname.startsWith("/subscriptions")) return "Subscriptions";
  if (pathname.startsWith("/flows")) return "Flows";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/commerce/catalogs")) return "Catalogs";
  if (pathname.startsWith("/commerce/products")) return "Products";
  if (pathname.startsWith("/commerce/settings")) return "Commerce settings";
  if (pathname.startsWith("/commerce")) return "Commerce";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/media")) return "Media";
  if (pathname.startsWith("/settings/integrations/whatsapp")) return "WhatsApp";
  if (pathname.startsWith("/settings/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/account")) return "Profile & security";
  if (pathname.startsWith("/settings/appearance")) return "Appearance";
  if (pathname.startsWith("/settings/workspace")) return "Workspace";
  if (pathname.startsWith("/settings/team")) return "Team";
  if (pathname.startsWith("/settings/password")) return "Password";
  if (pathname.startsWith("/settings/canned-responses")) return "Canned responses";
  if (pathname.startsWith("/settings/automations")) return "Automations";
  if (pathname.startsWith("/settings/business-hours")) return "Business hours";
  if (pathname.startsWith("/settings/features")) return "Features";
  if (pathname.startsWith("/settings/chatbot")) return "Chatbot";
  if (pathname.startsWith("/settings/knowledge")) return "Knowledge base";
  if (pathname.startsWith("/settings/developers")) return "Developers";
  if (pathname.startsWith("/settings/webhooks")) return "Webhooks";
  if (pathname.startsWith("/settings/danger")) return "Danger zone";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/platform")) return "Platform";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/feedback")) return "Feedback";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/usage")) return "Usage";
  return "MsgBuddy";
}
