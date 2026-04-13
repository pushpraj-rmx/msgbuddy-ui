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
  designation?: string;
  /** Profile / avatar image URL when provided by API (absolute or path served by API). */
  avatarUrl?: string | null;
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
  groupKey: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  channelTemplates?: ChannelTemplate[];
};

export type ChannelTemplate = {
  id: string;
  workspaceId: string;
  templateId: string;
  channel: TemplateChannel;
  category?: TemplateCategory;
  providerTemplateId?: string | null;
  providerStatus?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type ChannelTemplateVersion = {
  id: string;
  channelTemplateId: string;
  version: number;
  status: TemplateVersionStatus;
  isActive: boolean;
  isLocked: boolean;
  providerVersionId?: string | null;
  syncedAt?: string | null;
  syncError?: string | null;
  archivedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  /**
   * Sent to Meta on first template create as `allow_category_change`.
   * false = do not let Meta auto-reclassify to marketing from content.
   */
  allowCategoryChange?: boolean;
  /** Present on GET `/channel-templates/:id/versions/:version` (not on `/state` summaries). */
  body?: string;
  headerType?: TemplateHeaderType | null;
  headerContent?: string | null;
  /** Signed API path to stream WhatsApp header media (when headerContent is a media id). */
  headerPreviewUrl?: string | null;
  footer?: string | null;
  language?: string;
  parameterFormat?: "POSITIONAL" | "NAMED";
  ttlSeconds?: number | null;
  layoutType?: TemplateVersionLayoutType;
  buttons?: unknown;
  variables?: unknown;
  carouselCards?: unknown;
  createdAt?: string;
};

/** `PUT /v2/channel-templates/:id/versions/:version` — all fields optional. */
export type ChannelTemplateVersionUpdatePayload = {
  headerType?: TemplateHeaderType;
  headerContent?: string | null;
  body?: string;
  footer?: string | null;
  language?: string;
  parameterFormat?: "POSITIONAL" | "NAMED";
  ttlSeconds?: number | null;
  buttons?: unknown[] | null;
  variables?: unknown[] | null;
  layoutType?: TemplateVersionLayoutType;
  carouselCards?: unknown[] | null;
  allowCategoryChange?: boolean;
};

export type ChannelTemplateVersionPayload = {
  body: string;
  headerType?: TemplateHeaderType;
  headerContent?: string | null;
  footer?: string | null;
  language?: string;
  parameterFormat?: "POSITIONAL" | "NAMED";
  ttlSeconds?: number | null;
  buttons?: unknown[] | null;
  variables?: unknown[] | null;
  layoutType?: "STANDARD" | "CAROUSEL";
  carouselCards?: unknown[] | null;
  allowCategoryChange?: boolean;
};

/** `POST /v2/channel-templates/:id/versions/:version/sync` */
export type ChannelTemplateSyncResult = {
  success: boolean;
  providerTemplateId?: string;
  providerVersionId?: string;
  error?: string;
};

export type ChannelTemplateStateRequirementAction = {
  type: "CREATE_VERSION" | "VIEW_VERSIONS";
  label: string;
  method: "GET" | "POST" | "PATCH";
  href: string;
};

export type ChannelTemplateStateRequirement = {
  code: "NO_VERSION" | "NO_SENDABLE_VERSION";
  message: string;
  action?: ChannelTemplateStateRequirementAction;
};

export type ChannelTemplateState = {
  channelTemplateId: string;
  templateId: string;
  channel: TemplateChannel;
  category?: TemplateCategory | null;
  providerTemplateId: string | null;
  providerStatus: string | null;
  lastSyncError: string | null;
  latestVersion: ChannelTemplateVersion | null;
  activeVersion: ChannelTemplateVersion | null;
  latestSendableVersion: ChannelTemplateVersion | null;
  isSendable: boolean;
  missingRequirements: ChannelTemplateStateRequirement[];
  /** Meta `correct_category` differs from current — automated recategorization pending */
  categoryPendingChange: {
    currentCategory: string;
    correctCategory: string;
    fetchedAt: string | null;
  } | null;
  /** From `account_update` webhook — utility misuse / restriction (workspace default number) */
  whatsappUtilityRestriction: {
    level: string | null;
    detail: unknown;
    updatedAt: string | null;
  } | null;
};

export type TemplatesListResponse = {
  items: Template[];
  total: number;
  page: number;
  limit: number;
};

export type TemplateLimitsResponse = {
  current: number;
  max: number;
  isVerified: boolean;
};

export type NotificationType =
  | "CONVERSATION_ASSIGNED"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_FAILED"
  | "CONTACT_IMPORT_DONE"
  | "TEMPLATE_CATEGORY_CHANGE"
  | "WHATSAPP_RESTRICTION"
  | "SYSTEM";

export type NotificationSeverity = "INFO" | "WARNING" | "ERROR";

export type NotificationItem = {
  id: string;
  workspaceId: string;
  userId: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  idempotencyKey: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsListResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
};

// Auth and platform module (aligned with backend API)
export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "SUPERVISOR"
  | "AGENT"
  | "AUDITOR"
  | "VIEWER";
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
  plan?: string | null;
  planExpiresAt?: string | null;
  billingEmail?: string | null;
  subscriptionId?: string | null;
  billingCycleStart?: string | null;
  billingCycleEnd?: string | null;
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
  plan?: string | null;
  planExpiresAt?: string | null;
  billingEmail?: string | null;
  subscriptionId?: string | null;
  billingCycleStart?: string | null;
  billingCycleEnd?: string | null;
  trialEndsAt?: string | null;
  members?: PlatformWorkspaceMember[];
  settings?: Record<string, unknown> | null;
  messagingConfig?: Record<string, unknown> | null;
  cloudApiConfig?: {
    hasAccessToken?: boolean;
    [key: string]: unknown;
  } | null;
  cloudApiAccounts?: Array<{
    id: string;
    phoneNumberId?: string | null;
    displayPhoneNumber?: string | null;
    wabaId?: string | null;
    businessId?: string | null;
    status?: string | null;
    isDefault?: boolean;
    hasAccessToken?: boolean;
    tokenExpiresAt?: string | null;
    lastError?: string | null;
    [key: string]: unknown;
  }>;
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

export type PlatformAdminAuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
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

export type FeedbackType = "BUG" | "FEATURE_REQUEST";
export type FeedbackPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FeedbackStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "PLANNED"
  | "IN_PROGRESS"
  | "DONE"
  | "WONT_FIX";

export type FeedbackAttachment = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export type FeedbackReport = {
  id: string;
  workspaceId: string;
  userId: string;
  type: FeedbackType;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  attachments?: FeedbackAttachment[];
  metadata?: Record<string, unknown>;
  voteCount: number;
  adminNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  hasVoted: boolean;
  submittedBy?: string | null;
};

export type PaginatedFeedbackResponse = {
  items: FeedbackReport[];
  total: number;
  page: number;
  limit: number;
};
