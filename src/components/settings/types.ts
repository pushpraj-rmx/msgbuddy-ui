import type { WorkspaceSettingsPayload } from "@/lib/api";

/**
 * Shared shapes for the Settings section. These used to live inside
 * SettingsClient (the old single-page hub); they now back the split
 * routed settings pages (/settings/workspace, /settings/chatbot, …).
 */

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  businessId?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  timezone?: string;
  locale?: string;
  businessName?: string;
  industry?: string;
  country?: string;
  phone?: string;
  email?: string;
  businessAddress?: string;
  businessAbout?: string;
  businessVertical?: string;
  status?: string;
};

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

export type Member = {
  id: string;
  role: string;
  user?: { id?: string; email?: string; name?: string | null };
};
