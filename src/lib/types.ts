// Contact module types (aligned with backend API)

/** Tag shape when returned with contact list/detail include=tags */
export type ContactTag = { id: string; name: string; color: string };

export type Contact = {
  id: string;
  workspaceId: string;
  phone: string;
  phoneLabel?: string;
  name?: string;
  email?: string;
  emailLabel?: string;
  isBlocked: boolean;
  isOptedOut: boolean;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  tags?: ContactTag[] | Tag[];
  customFields?: Record<string, string>;
};

export type ContactsListResponse = {
  contacts: Contact[];
  nextCursor?: string | null;
  totalCount?: number;
};

export type Tag = {
  id: string;
  workspaceId: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "URL"
  | "EMAIL";

export type CustomFieldDef = {
  id: string;
  workspaceId: string;
  name: string;
  label: string;
  type: CustomFieldType;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldValue = {
  fieldId: string;
  fieldName: string;
  label: string;
  value: string;
};

export type ContactNote = {
  id: string;
  contactId: string;
  authorUserId: string;
  content: string;
  createdAt: string;
};

export type SegmentQuery = {
  tags?: string[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  isBlocked?: boolean;
  isOptedOut?: boolean;
  customFields?: Array<{ name: string; op: "eq" | "ne" | "contains"; value: string }>;
  lastMessageAfter?: string;
  lastMessageBefore?: string;
};

export type Segment = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  query: SegmentQuery;
  contactCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SegmentPreviewResponse = {
  contacts: Array<{ id: string; phone: string; name?: string; email?: string }>;
  contactCount: number;
};

export type TimelineItemType = "note" | "message";

export type TimelineItem = {
  type: TimelineItemType;
  id: string;
  createdAt: string;
  data: {
    content?: string;
    authorUserId?: string;
    direction?: string;
    text?: string;
    type?: string;
    status?: string;
  };
};

export type TimelineResponse = {
  items: TimelineItem[];
  nextCursor: string | null;
};

export type DuplicateGroup = {
  contacts: Contact[];
  matchedOn: "phone" | "email";
};

export type DuplicatesResponse = {
  duplicateGroups: DuplicateGroup[];
};

export type ImportResult = {
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

// Template module (aligned with backend API)
export type TemplateChannel = "WHATSAPP" | "TELEGRAM" | "MSGBUDDY" | "EMAIL" | "SMS";
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT";
export type TemplateVersionStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROVIDER_PENDING"
  | "PROVIDER_APPROVED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_PAUSED"
  | "PROVIDER_DISABLED";

export type TemplateVersionLayoutType = "STANDARD" | "CAROUSEL";

/** One card in a carousel template (when layoutType is CAROUSEL) */
export type TemplateCarouselCard = {
  headerFormat: "IMAGE" | "VIDEO";
  headerHandle: string;
  body: string;
  buttons: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
};

export type TemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  headerType: TemplateHeaderType;
  headerContent: string | null;
  body: string;
  footer: string | null;
  language: string;
  status: TemplateVersionStatus;
  providerRejectionReason: string | null;
  layoutType: TemplateVersionLayoutType;
  carouselCards: TemplateCarouselCard[] | null;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  providerVersionId: string | null;
  isLocked: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Template = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  channel: TemplateChannel;
  category: TemplateCategory;
  providerTemplateId: string | null;
  providerStatus?: string | null;
  lastFetchedAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: TemplateVersion[];
};

/** Payload for creating or updating a template version (DRAFT only for update) */
export type TemplateVersionPayload = {
  body: string;
  headerType?: TemplateHeaderType;
  headerContent?: string | null;
  footer?: string | null;
  language?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  variables?: Array<{ key: string; example?: string }>;
  layoutType?: TemplateVersionLayoutType;
  carouselCards?: TemplateCarouselCard[] | null;
};

export type TemplatesListResponse = {
  items: Template[];
  total: number;
  page: number;
  limit: number;
};

export type TemplateSyncResponse = {
  success: boolean;
  providerTemplateId?: string;
  providerVersionId?: string;
  error?: string;
};

export type TemplateImportResponse = {
  imported: number;
  updated: number;
  flagged: number;
};

export type TemplateLimitsResponse = {
  current: number;
  max: number;
  isVerified: boolean;
};

// Auth and platform module (aligned with backend API)
export type WorkspaceRole = "OWNER" | "ADMIN" | "AGENT";
export type PlatformRole = "SUPERADMIN" | "SUPPORT" | "NONE";

export type OffsetPaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type PlatformWorkspaceStatus =
  | "ACTIVE"
  | "TRIAL"
  | "SUSPENDED"
  | "CANCELLED"
  | "DELETED";

export type PlatformWorkspaceListItem = {
  id: string;
  slug: string;
  name: string;
  status: PlatformWorkspaceStatus;
  isSuspended: boolean;
  suspendedAt?: string | null;
  _count: {
    workspaceMembers: number;
    contacts: number;
    conversations: number;
    messages: number;
  };
};

export type PlatformWorkspaceMember = {
  id: string;
  role: WorkspaceRole | string;
  user?: {
    id?: string;
    email?: string;
    name?: string | null;
  };
};

export type PlatformWorkspaceDetail = {
  id: string;
  slug: string;
  name: string;
  status: PlatformWorkspaceStatus;
  isSuspended: boolean;
  suspendedAt?: string | null;
  members?: PlatformWorkspaceMember[];
  settings?: Record<string, unknown> | null;
  messagingConfig?: Record<string, unknown> | null;
  cloudApiConfig?: {
    hasAccessToken?: boolean;
    [key: string]: unknown;
  } | null;
  _count?: Partial<PlatformWorkspaceListItem["_count"]>;
  [key: string]: unknown;
};

export type PlatformUserMembership = {
  workspaceId: string;
  role: WorkspaceRole | string;
  workspace?: {
    id: string;
    slug: string;
    name: string;
    status: PlatformWorkspaceStatus;
  };
};

export type PlatformUserListItem = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  isActive?: boolean;
  platformRole: PlatformRole;
  memberships?: PlatformUserMembership[];
};

export type PlatformUserDetail = PlatformUserListItem & {
  memberships: PlatformUserMembership[];
};

export type PlatformWebhookLog = {
  id: string;
  workspaceId: string;
  provider: string;
  processed: boolean;
  eventType: string;
  createdAt: string;
};

export type PlatformUsageEvent = {
  id: string;
  workspaceId: string;
  eventType: string;
  createdAt: string;
  [key: string]: unknown;
};

export type PlatformBsp = "TWILIO" | "INTERAKT" | "AISENSY" | "OTHER";

export type PlatformBspCredential = {
  id: string;
  bsp: PlatformBsp;
  webhookUrl?: string | null;
  hasWebhookSecret: boolean;
  isActive: boolean;
  credentialKeys: string[];
};

export type PlatformChannelAccount = {
  id: string;
  channel?: string;
  provider?: string;
  displayName?: string;
  externalId?: string;
  workspaceId?: string | null;
  workspace?: {
    id: string;
    slug?: string;
    name?: string;
  } | null;
  [key: string]: unknown;
};

export type WabaPhoneNumber = {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  quality: string;
  status: string;
};

export type OnboardingWaba = {
  id: string;
  name: string;
  timezone?: string;
  currency?: string;
  messageTemplateNamespace?: string;
  accountReviewStatus?: string;
  businessId?: string;
  businessName?: string;
  isClientShared?: boolean;
  permissions?: string[];
  phoneNumbers: WabaPhoneNumber[];
};

export type OnboardingWabaListResponse = {
  wabas: OnboardingWaba[];
  count: number;
};
