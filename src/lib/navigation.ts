import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import ForumRounded from "@mui/icons-material/ForumRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import HomeRounded from "@mui/icons-material/HomeRounded";
import LabelRounded from "@mui/icons-material/LabelRounded";
import LayersRounded from "@mui/icons-material/LayersRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhotoRounded from "@mui/icons-material/PhotoRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TerminalRounded from "@mui/icons-material/TerminalRounded";
import { canAccessPlatform, isSuperAdmin } from "@/lib/platform-access";

/** MUI Material Icons, rounded variant (`SvgIcon`) used in nav / dock / sidebar. */
type NavIcon = ComponentType<SvgIconProps>;

export type AppNavItem = {
  href: string;
  label: string;
  Icon: NavIcon;
  showInDock?: boolean;
  children?: Array<{ href: string; label: string; Icon: NavIcon }>;
};

export function getAppNav(platformRole: string): AppNavItem[] {
  const items: AppNavItem[] = [
    { href: "/dashboard", label: "Dashboard", Icon: HomeRounded, showInDock: true },
    { href: "/inbox", label: "Inbox", Icon: ForumRounded, showInDock: true },
    {
      href: "/people/contacts",
      label: "People",
      Icon: GroupsRounded,
      showInDock: true,
      children: [
        { href: "/people/contacts", label: "Contacts", Icon: PersonRounded },
        { href: "/people/tags", label: "Tags", Icon: LabelRounded },
        { href: "/people/segments", label: "Segments", Icon: GridViewRounded },
      ],
    },
    { href: "/campaigns", label: "Campaigns", Icon: RocketLaunchRounded },
    { href: "/templates", label: "Templates", Icon: ArticleRounded },
    { href: "/media", label: "Media", Icon: PhotoRounded },
    { href: "/analytics", label: "Analytics", Icon: BarChartRounded },
    { href: "/notifications", label: "Notifications", Icon: NotificationsRounded },
    { href: "/usage", label: "Usage", Icon: LayersRounded },
    { href: "/settings", label: "Settings", Icon: SettingsRounded, showInDock: true },
  ];

  if (canAccessPlatform(platformRole)) {
    items.push({ href: "/platform", label: "Platform", Icon: TerminalRounded });
    items.push({ href: "/ops", label: "Ops", Icon: TerminalRounded });
  }
  if (isSuperAdmin(platformRole)) {
    items.push({ href: "/onboarding", label: "Onboarding", Icon: TerminalRounded });
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
  if (pathname.startsWith("/people/segments")) return "Segments";
  if (pathname.startsWith("/people/tags")) return "Tags";
  if (pathname.startsWith("/people/contacts")) return "Contacts";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/media")) return "Media";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/settings/integrations/whatsapp")) return "WhatsApp";
  if (pathname.startsWith("/settings/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/team")) return "Team";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/platform")) return "Platform";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/usage")) return "Usage";
  return "MsgBuddy";
}
