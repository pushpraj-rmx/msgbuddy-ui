// Contact module types (aligned with backend API)

/** Tag shape when returned with contact list/detail include=tags */
export type ContactTag = { id: string; name: string; color: string };

/** Ordered funnel — keep in sync with Prisma `ContactLifecycleStage`. */
export const CONTACT_LIFECYCLE_STAGES = [
  "LEAD",
  "ENGAGED",
  "QUALIFIED",
  "CUSTOMER",
  "DORMANT",
  "LOST",
] as const;
export type ContactLifecycleStage =
  (typeof CONTACT_LIFECYCLE_STAGES)[number];

export type Contact = {
  id: string;
  workspaceId: string;
  phone: string;
  phoneLabel?: string;
  /**
   * ISO 3166-1 alpha-2 derived server-side from `phone` (no stored column).
   * The number's registered region, not a verified location.
   */
  country?: string | null;
  name?: string;
  email?: string;
  emailLabel?: string;
  designation?: string;
  /** Profile / avatar image URL when provided by API (absolute or path served by API). */
  avatarUrl?: string | null;
  isBlocked: boolean;
  isOptedOut: boolean;
  /** Null when the contact hasn't been classified yet. */
  lifecycleStage?: ContactLifecycleStage | null;
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
  /** @deprecated Use tagIds. Legacy: tag names. */
  tags?: string[];
  /** Preferred: tag IDs. Combined per `tagsMatch` (default 'all' = AND). */
  tagIds?: string[];
  /** 'all' = must have every tag (AND, default); 'any' = at least one (OR). */
  tagsMatch?: "all" | "any";
  hasEmail?: boolean;
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

/**
 * GET /contacts/:id/last-location — the most recent location pin the contact
 * shared over WhatsApp. `null` when they never shared one.
 */
export type ContactLastLocation = {
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
  /** ISO timestamp of the message that carried the pin. */
  sharedAt: string;
};

export type DuplicateGroup = {
  contacts: Contact[];
  matchedOn: "phone" | "email";
};

export type DuplicatesResponse = {
  duplicateGroups: DuplicateGroup[];
};

export type ImportMode = "create_only" | "update_only" | "merge";

export type ImportFieldDiff = {
  from: string | null;
  to: string | null;
};

export type ImportRowSample = {
  row: number;
  phone: string;
  name?: string;
  action: "create" | "update" | "skip" | "error";
  diff?: Record<string, ImportFieldDiff>;
  reason?: string;
};

export type ImportApplyResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export type ImportResult = {
  mode: ImportMode;
  dryRun: boolean;
  totals: {
    totalRows: number;
    /** CSV rows merged into a previous row with the same normalized phone. */
    mergedDuplicates: number;
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    willError: number;
  };
  sample: {
    create: ImportRowSample[];
    update: ImportRowSample[];
    skip: ImportRowSample[];
    error: ImportRowSample[];
  };
  newTags: string[];
  newCustomFields: Array<{ name: string; label: string }>;
  result: ImportApplyResult | null;
};

// ===== Async import jobs =====

export type ImportJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ImportJobMode = "CREATE_ONLY" | "UPDATE_ONLY" | "MERGE";

/** ImportJob row as returned by GET /contacts/import/jobs/:id */
export type ImportJob = {
  id: string;
  workspaceId: string;
  userId: string;
  filename: string;
  mode: ImportJobMode;
  defaultCountry: string;
  dryRun: boolean;
  status: ImportJobStatus;
  totalRows: number | null;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  mergedDuplicates: number;
  errors: Array<{ row: number; message: string }>;
  newTags: string[];
  newCustomFields: Array<{ name: string; label: string }>;
  sample: ImportResult["sample"] | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ImportJobStartResponse = {
  jobId: string;
  status: ImportJobStatus;
};

// ===== Background Tasks (cross-domain bar in the topbar) =====

export type BackgroundTaskKind = "contact-import";

export type BackgroundTask = {
  id: string;
  kind: BackgroundTaskKind;
  label: string;
  /** RUNNING | QUEUED | COMPLETED | FAILED | CANCELLED */
  status: string;
  processed: number;
  total: number | null;
  href?: string;
  detail?: string;
  createdAt: string;
};

export type PhoneCheckResult = {
  exists: boolean;
  contact?: { id: string; phone: string; name?: string | null; email?: string | null };
};

// Template module (aligned with backend API)
export type TemplateChannel = "WHATSAPP" | "TELEGRAM" | "MSGBUDDY" | "EMAIL" | "SMS";
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "LOCATION";
export type TemplateVersionStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROVIDER_PENDING"
  | "PROVIDER_APPROVED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_PAUSED"
  | "PROVIDER_DISABLED"
  | "PROVIDER_IN_APPEAL";

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
  /** Lifetime number of times this template has been sent (from TemplateSendLog). */
  sendCount?: number;
};

/** Meta's template quality rating, surfaced once a template has been live and received feedback. */
export type TemplateQualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export type ChannelTemplate = {
  id: string;
  workspaceId: string;
  templateId: string;
  channel: TemplateChannel;
  category?: TemplateCategory;
  providerTemplateId?: string | null;
  providerStatus?: string | null;
  /** Raw quality string from Meta. Use `normalizeQualityRating()` when reading. */
  qualityScore?: string | null;
  lastQualityCheckAt?: string | null;
  /** Meta's proposed category when it differs from `category` (reclassification pending). */
  providerCorrectCategory?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/** Coerce a free-form Meta quality string into one of our four rating values. */
export function normalizeQualityRating(
  raw: string | null | undefined
): TemplateQualityRating {
  const u = (raw ?? "").toString().trim().toUpperCase();
  if (u === "GREEN" || u === "HIGH" || u === "HIGH_QUALITY") return "GREEN";
  if (u === "YELLOW" || u === "MEDIUM" || u === "MEDIUM_QUALITY") return "YELLOW";
  if (u === "RED" || u === "LOW" || u === "LOW_QUALITY") return "RED";
  return "UNKNOWN";
}

export type ChannelTemplateVersion = {
  id: string;
  channelTemplateId: string;
  /**
   * Parent channel template, optionally included by `findById` so the UI can
   * read category + provider state without a second round-trip. Absent on
   * list endpoints to keep the wire payload lean.
   */
  channelTemplate?: ChannelTemplate;
  version: number;
  status: TemplateVersionStatus;
  isActive: boolean;
  isLocked: boolean;
  providerVersionId?: string | null;
  syncedAt?: string | null;
  syncError?: string | null;
  /** Rejection reason from Meta content review (async webhook). */
  providerRejectionReason?: string | null;
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
  /** AUTHENTICATION templates only — fixed OTP shape (see TemplateAuthConfig). */
  authConfig?: TemplateAuthConfig | null;
  /** MARKETING limited-time-offer templates only (see TemplateLimitedTimeOffer). */
  limitedTimeOffer?: TemplateLimitedTimeOffer | null;
  createdAt?: string;
};

export type TemplateOtpType = "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";

/** MARKETING limited-time-offer (countdown) config. `expiration_time_ms` is supplied per send. */
export type TemplateLimitedTimeOffer = {
  /** Offer label, ≤16 chars (e.g. "10% off today"). */
  text?: string;
  /** When true, a live countdown to the offer's expiry is shown; requires `offer_expiration` at send. */
  hasExpiration?: boolean;
};

export type TemplateAuthConfig = {
  otpType: TemplateOtpType;
  buttonText?: string;
  addSecurityRecommendation?: boolean;
  codeExpirationMinutes?: number;
  autofillText?: string;
  packageName?: string;
  signatureHash?: string;
  zeroTapTermsAccepted?: boolean;
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
  authConfig?: TemplateAuthConfig | null;
  limitedTimeOffer?: TemplateLimitedTimeOffer | null;
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
  authConfig?: TemplateAuthConfig | null;
};

/** `POST /v2/channel-templates/:id/versions/:version/sync` */
export type ChannelTemplateSyncResult = {
  success: boolean;
  providerTemplateId?: string;
  providerVersionId?: string;
  error?: string;
  /** Non-fatal notice on a successful sync (e.g. Meta enforced a different category). */
  warning?: string;
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
  /** Exact name registered with Meta; what sends actually address (decoupled from display name). */
  providerTemplateName?: string | null;
  providerStatus: string | null;
  /** Meta-reported quality (raw string). Pass through `normalizeQualityRating`. */
  qualityScore?: string | null;
  lastQualityCheckAt?: string | null;
  lastSyncError: string | null;
  latestVersion: ChannelTemplateVersion | null;
  activeVersion: ChannelTemplateVersion | null;
  latestSendableVersion: ChannelTemplateVersion | null;
  /** Text placeholder keys ("1", "first_name", "header_1", "button_1_code"…) the send must bind. */
  requiredVariableKeys?: string[];
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
  /** From `phone_number_quality_update` webhook — phone-number-level quality. */
  whatsappPhoneQuality: {
    /** GREEN | YELLOW | RED | FLAGGED | other. */
    rating: string | null;
    displayPhoneNumber: string | null;
    /** Set when the number first entered FLAGGED; used to compute the 7-day countdown. */
    flaggedAt: string | null;
    checkedAt: string | null;
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
  | "CONVERSATION_REASSIGNED"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_FAILED"
  | "CONTACT_IMPORT_DONE"
  | "TEMPLATE_CATEGORY_CHANGE"
  | "WHATSAPP_RESTRICTION"
  | "PLAN_CHANGED"
  | "TRIAL_EXPIRING"
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
  deletedAt?: string | null;
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
  workspaceName?: string | null;
  provider: string;
  processed: boolean;
  eventType: string;
  createdAt: string;
};

export type PlatformUsageEvent = {
  id: string;
  workspaceId: string;
  workspaceName?: string | null;
  eventType: string;
  createdAt: string;
  [key: string]: unknown;
};

export type PlatformAdminAuditLog = {
  id: string;
  actorUserId: string;
  actorName?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  targetName?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
};


export type AccountAccessRequestStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export type PlatformAccessRequest = {
  id: string;
  email: string;
  alternateContact: string;
  message?: string | null;
  status: AccountAccessRequestStatus;
  userId?: string | null;
  handledByAdminId?: string | null;
  resetLinkGeneratedAt?: string | null;
  notes?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResetLinkResponse = {
  url: string;
  expiresInSeconds: number;
};

export type PlatformChannelAccount = {
  id: string;
  channel?: string;
  provider?: string;
  displayName?: string;
  externalId?: string;
  externalRef?: string;
  cloudApiAccountId?: string | null;
  /** Human-readable number resolved from the linked CloudApiAccount. */
  cloudApiAccount?: { displayPhoneNumber?: string | null; wabaId?: string } | null;
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

export type OnboardingSharingInfo = {
  /** Our partner business id customers add in Business Manager; null if unset. */
  partnerBusinessId: string | null;
  graphApiVersion: string;
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

// ─── Commerce (Meta product catalogs mirrored for WhatsApp) ───────────────────

/** Mirror sync state of a catalog's products. Keep in sync with backend. */
export type ProductCatalogSyncStatus =
  | "NEVER_SYNCED"
  | "SYNCING"
  | "SYNCED"
  | "ERROR";

/** A Meta product catalog surfaced via the workspace's System User credential. */
export type ProductCatalog = {
  id: string;
  metaCatalogId: string;
  name: string;
  vertical?: string | null;
  productCount: number;
  feedCount: number;
  connectedToWaba: boolean;
  syncStatus: ProductCatalogSyncStatus;
  lastSyncedAt?: string | null;
  createdAt?: string;
};

/** A single product mirrored from a Meta catalog. Money fields are strings. */
export type CatalogProduct = {
  id: string;
  catalogId: string;
  retailerId: string;
  name: string;
  description?: string | null;
  price?: string | null;
  currency?: string | null;
  availability: string;
  condition?: string | null;
  imageUrl?: string | null;
  additionalImageUrls?: string[];
  url?: string | null;
  brand?: string | null;
  category?: string | null;
  visibility: string;
  reviewStatus?: string | null;
  inventory?: number | null;
  updatedAt?: string;
};

/** Audit record for a catalog product-mirror sync run. */
export type ProductSyncLog = {
  id: string;
  kind: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  failedCount: number;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
};

/** GET /commerce/credential — connection state for the catalog System User token. */
export type CommerceCredentialStatus = {
  connected: boolean;
  status: "PENDING" | "CONNECTED" | "ERROR" | "DISCONNECTED";
  businessId: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
};

/** GET /commerce/products — offset-paginated product mirror. */
export type CommerceProductsResponse = {
  items: CatalogProduct[];
  total: number;
  page: number;
  limit: number;
};
