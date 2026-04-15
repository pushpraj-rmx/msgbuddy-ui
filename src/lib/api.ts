import api, { fetchWithAuthRefresh } from "./axios";
import { API_BASE_URL, endpoints } from "./endpoints";
import type { InboxMessage, MediaItem } from "./messaging";
import type {
  Contact,
  ContactsListResponse,
  Tag,
  CustomFieldDef,
  CustomFieldValue,
  ContactNote,
  Segment,
  SegmentQuery,
  SegmentPreviewResponse,
  TimelineResponse,
  DuplicatesResponse,
  ImportResult,
  PhoneCheckResult,
  Template,
  TemplatesListResponse,
  TemplateLimitsResponse,
  TemplateChannel,
  TemplateCategory,
  ChannelTemplateState,
  ChannelTemplateVersion,
  ChannelTemplateVersionPayload,
  ChannelTemplateVersionUpdatePayload,
  ChannelTemplateSyncResult,
  WorkspaceRole,
  PlatformRole,
  OffsetPaginatedResponse,
  PlatformWorkspaceListItem,
  PlatformWorkspaceStatus,
  PlatformWorkspaceDetail,
  PlatformUserListItem,
  PlatformUserDetail,
  PlatformWebhookLog,
  PlatformUsageEvent,
  PlatformAdminAuditLog,
  PlatformChannelAccount,
  OnboardingWabaListResponse,
  NotificationItem,
  NotificationsListResponse,
  FeedbackReport,
  PaginatedFeedbackResponse,
  FeedbackType,
  FeedbackPriority,
  FeedbackAttachment,
} from "./types";

export type {
  Template,
  TemplateChannel,
  TemplateCategory,
};

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

/** POST /auth/register when email verification is required before tokens are issued. */
export interface RegisterPendingVerificationResponse {
  requiresEmailVerification: true;
  email: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
  /** True when the account can sign in with email + password (not Google-only). */
  hasPassword?: boolean;
}

/** GET /auth/login-history */
export type LoginHistoryEvent = {
  id: string;
  userId: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export interface Workspace {
  id: string;
  name: string;
  plan?: string;
  status?: string;
  trialEndsAt?: string | null;
}

export type WorkspaceMemberResponseDto = {
  id: string;
  workspaceId: string;
  role: WorkspaceRole | string;
  isActive: boolean;
  joinedAt: string;
  user?: {
    id?: string;
    email?: string;
    name?: string | null;
  };
};

export type WorkspaceWithRoleDto = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  timezone: string;
  locale: string;
  businessName?: string;
  industry?: string;
  country?: string;
  phone?: string;
  email?: string;
  businessAddress?: string;
  businessAbout?: string;
  businessVertical?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  role: WorkspaceRole | string;
  joinedAt: string;
};

export type CreateWorkspaceDto = { name: string };

export type UpdateWorkspaceDto = Partial<{
  name: string;
  description: string;
  logoUrl: string;
  website: string;
  timezone: string;
  locale: string;
  businessName: string;
  industry: string;
  country: string;
  phone: string;
  email: string;
  businessAddress: string;
  businessAbout: string;
  businessVertical: string;
}>;

export interface MeResponse {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole | string;
  platformRole: PlatformRole;
}

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(endpoints.auth.register, data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(endpoints.auth.login, data);
    return response.data;
  },

  getMe: async (): Promise<MeResponse> => {
    const response = await api.get<MeResponse>(endpoints.auth.me);
    return response.data;
  },
};

export interface ConversationFilters {
  status?: "OPEN" | "CLOSED" | "ARCHIVED";
  channel?: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  assignedUserId?: string;
  unassignedOnly?: boolean;
  tagIds?: string;
  search?: string;
  unreadOnly?: boolean;
  awaitingReplyOnly?: boolean;
  includeSnoozed?: boolean;
  snoozedOnly?: boolean;
  sort?: "lastMessageAt" | "awaitingReply";
  limit?: number;
  cursor?: string;
}

/** WhatsApp Cloud outbound media kinds (see MESSAGE_CONTRACT / send-message.dto). */
export type WhatsAppOutboundMediaType =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT";

export type ConversationSendPolicyDto = {
  channel: "WHATSAPP";
  freeformAllowed: boolean;
  templateRequired: boolean;
  windowHours: number;
  latestInboundAt?: string | null;
  windowClosesAt?: string | null;
};

export type InternalTargetType = "CONTACT" | "CONVERSATION" | "CAMPAIGN";

export type InternalNote = {
  id: string;
  workspaceId?: string;
  targetType: InternalTargetType;
  targetId: string;
  content: string;
  isPinned?: boolean;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** POST /v2/messages — TEXT (default) vs WhatsApp media (mediaId + type). */
export type SendMessagePayload =
  | {
      contactId: string;
      text: string;
      idempotencyKey?: string;
      channel?: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
      type?: "TEXT";
      sendAt?: string;
    }
  | {
      contactId: string;
      type: WhatsAppOutboundMediaType;
      mediaId: string;
      text?: string;
      idempotencyKey?: string;
      channel: "WHATSAPP";
      sendAt?: string;
    }
  | {
      contactId: string;
      channel: "WHATSAPP";
      channelTemplateVersionId: string;
      templateVariables?: Record<string, string>;
      idempotencyKey?: string;
      sendAt?: string;
    };

/** POST /v2/media/:id/prepare-whatsapp */
export type PrepareWhatsAppResponseDto = {
  mediaId: string;
  whatsappMediaId: string;
};

export const conversationsApi = {
  list: async (params: ConversationFilters = {}) => {
    const response = await api.get(endpoints.conversations.list, { params });
    return response.data;
  },
  /** GET /v2/conversations/stats — workspace-wide counts (shape is backend-defined). */
  stats: async (): Promise<Record<string, unknown>> => {
    const response = await api.get(endpoints.conversations.stats);
    return response.data as Record<string, unknown>;
  },
  messages: async (conversationId: string) => {
    const response = await api.get(
      endpoints.messages.listByConversation(conversationId)
    );
    return response.data;
  },
  sendMessage: async (data: SendMessagePayload) => {
    const response = await api.post(endpoints.messages.send, data);
    return response.data;
  },
  getSendPolicy: async (contactId: string): Promise<ConversationSendPolicyDto> => {
    const response = await api.get<ConversationSendPolicyDto>(
      endpoints.messages.policy(contactId)
    );
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(endpoints.conversations.byId(id));
    return response.data;
  },
  listByContact: async (contactId: string) => {
    const response = await api.get(endpoints.conversations.byContact(contactId));
    return response.data;
  },
  open: async (id: string) => {
    const response = await api.put(endpoints.conversations.open(id));
    return response.data;
  },
  close: async (id: string) => {
    const response = await api.put(endpoints.conversations.close(id));
    return response.data;
  },
  archive: async (id: string) => {
    const response = await api.put(endpoints.conversations.archive(id));
    return response.data;
  },
  read: async (id: string) => {
    const response = await api.put(endpoints.conversations.read(id));
    return response.data;
  },
  snooze: async (id: string, until: string) => {
    const response = await api.put(endpoints.conversations.snooze(id), { until });
    return response.data;
  },
  unsnooze: async (id: string) => {
    const response = await api.put(endpoints.conversations.unsnooze(id));
    return response.data;
  },
  assign: async (id: string, userId: string) => {
    const response = await api.put(endpoints.conversations.assign(id), { userId });
    return response.data;
  },
  unassign: async (id: string) => {
    const response = await api.put(endpoints.conversations.unassign(id));
    return response.data;
  },
  claim: async (id: string) => {
    const response = await api.post(endpoints.conversations.claim(id));
    return response.data;
  },
  release: async (id: string) => {
    const response = await api.post(endpoints.conversations.release(id));
    return response.data;
  },
  searchMessages: async (params: {
    q: string;
    conversationId: string;
    limit?: number;
  }) => {
    const response = await api.get(endpoints.messages.search, { params });
    return response.data;
  },
  getMessageById: async (id: string) => {
    const response = await api.get(endpoints.messages.byId(id));
    return response.data;
  },
  updateMessageStatus: async (
    id: string,
    status: "PENDING" | "PROCESSING" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED"
  ) => {
    const response = await api.put(endpoints.messages.updateStatus(id), { status });
    return response.data;
  },
  // ─── Pin ────────────────────────────────────────────────────────────────────
  getPinnedMessages: async (conversationId: string) => {
    const response = await api.get(endpoints.messages.pinnedByConversation(conversationId));
    return response.data;
  },
  pinMessage: async (messageId: string) => {
    const response = await api.post(endpoints.messages.pin(messageId));
    return response.data;
  },
  unpinMessage: async (messageId: string) => {
    const response = await api.delete(endpoints.messages.pin(messageId));
    return response.data;
  },
  // ─── Star ───────────────────────────────────────────────────────────────────
  starMessage: async (messageId: string) => {
    const response = await api.post(endpoints.messages.star(messageId));
    return response.data;
  },
  unstarMessage: async (messageId: string) => {
    const response = await api.delete(endpoints.messages.star(messageId));
    return response.data;
  },
  listStarred: async (cursor?: string, limit?: number) => {
    const response = await api.get(endpoints.messages.starred, { params: { cursor, limit } });
    return response.data as { messages: InboxMessage[]; nextCursor: string | null };
  },
  // ─── Media gallery ──────────────────────────────────────────────────────────
  listConversationMedia: async (conversationId: string, cursor?: string, limit?: number) => {
    const response = await api.get(endpoints.messages.mediaByConversation(conversationId), {
      params: { cursor, limit },
    });
    return response.data as { media: MediaItem[]; nextCursor: string | null };
  },
  // ─── Scheduled ──────────────────────────────────────────────────────────────
  listScheduled: async (cursor?: string, limit?: number) => {
    const response = await api.get(endpoints.messages.scheduled, { params: { cursor, limit } });
    return response.data as { messages: InboxMessage[]; nextCursor: string | null };
  },
  cancelScheduledMessage: async (messageId: string) => {
    const response = await api.delete(endpoints.messages.byId(messageId));
    return response.data;
  },
};

export const presenceApi = {
  heartbeatConversationView: async (conversationId: string) => {
    const response = await api.post(
      endpoints.presence.viewConversation(conversationId)
    );
    return response.data;
  },
  clearConversationView: async (conversationId: string) => {
    const response = await api.delete(
      endpoints.presence.viewConversation(conversationId)
    );
    return response.data;
  },
};

export const internalApi = {
  listNotes: async (
    targetType: InternalTargetType,
    targetId: string
  ): Promise<InternalNote[]> => {
    const response = await api.get<InternalNote[]>(endpoints.internal.notes, {
      params: { targetType, targetId },
    });
    return response.data;
  },
  createNote: async (data: {
    targetType: InternalTargetType;
    targetId: string;
    content: string;
    isPinned?: boolean;
  }): Promise<InternalNote> => {
    const response = await api.post<InternalNote>(endpoints.internal.notes, data);
    return response.data;
  },
  updateNote: async (
    id: string,
    data: { content?: string; isPinned?: boolean }
  ): Promise<InternalNote> => {
    const response = await api.put<InternalNote>(
      endpoints.internal.noteById(id),
      data
    );
    return response.data;
  },
  deleteNote: async (id: string): Promise<void> => {
    await api.delete(endpoints.internal.noteById(id));
  },
  toggleNotePin: async (id: string): Promise<InternalNote> => {
    const response = await api.post<InternalNote>(endpoints.internal.toggleNotePin(id));
    return response.data;
  },
};

export const notificationsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationsListResponse> => {
    const response = await api.get<NotificationsListResponse>(
      endpoints.notifications.list,
      { params }
    );
    return response.data;
  },
  unreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get<{ count: number }>(
      endpoints.notifications.unreadCount
    );
    return response.data;
  },
  markRead: async (id: string): Promise<NotificationItem> => {
    const response = await api.patch<NotificationItem>(
      endpoints.notifications.markRead(id)
    );
    return response.data;
  },
  markAllRead: async (): Promise<{ count: number }> => {
    const response = await api.patch<{ count: number }>(
      endpoints.notifications.markAllRead
    );
    return response.data;
  },
};

export type ContactsListSort =
  | "lastMessageAt"
  | "name"
  | "email"
  | "phone"
  | "createdAt"
  | "updatedAt";

export const contactsApi = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    segmentId?: string;
    search?: string;
    sort?: ContactsListSort;
    order?: "asc" | "desc";
    includeTotal?: boolean;
    include?: string;
  }): Promise<ContactsListResponse> => {
    const response = await api.get<ContactsListResponse>(
      endpoints.contacts.list,
      { params }
    );
    return response.data;
  },
  getOne: async (
    id: string,
    params?: { include?: string }
  ): Promise<Contact> => {
    const response = await api.get<Contact>(endpoints.contacts.byId(id), {
      params,
    });
    return response.data;
  },
  create: async (data: {
    phone: string;
    phoneLabel?: string;
    name?: string;
    designation?: string;
    email?: string;
    emailLabel?: string;
  }): Promise<Contact> => {
    const response = await api.post<Contact>(endpoints.contacts.create, data);
    return response.data;
  },
  checkPhone: async (phone: string): Promise<PhoneCheckResult> => {
    const response = await api.get<PhoneCheckResult>(
      endpoints.contacts.checkPhone,
      { params: { phone } }
    );
    return response.data;
  },
  importCsv: async (
    file: File,
    options?: { defaultCountry?: string }
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<ImportResult>(
      endpoints.contacts.import,
      formData,
      { params: options?.defaultCountry ? { defaultCountry: options.defaultCountry } : undefined }
    );
    return response.data;
  },
  exportCsv: async (): Promise<void> => {
    const response = await api.get(endpoints.contacts.export, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
  update: async (
    id: string,
    data: {
      name?: string;
      designation?: string;
      email?: string;
      phoneLabel?: string;
      emailLabel?: string;
      isBlocked?: boolean;
      isOptedOut?: boolean;
      avatarUrl?: string;
    }
  ): Promise<Contact> => {
    const response = await api.put<Contact>(endpoints.contacts.byId(id), data);
    return response.data;
  },
  updateConsent: async (
    id: string,
    data: { isBlocked?: boolean; isOptedOut?: boolean }
  ): Promise<Contact> => {
    const response = await api.put<Contact>(
      endpoints.contacts.consent(id),
      data
    );
    return response.data;
  },
  delete: async (id: string): Promise<Contact> => {
    const response = await api.delete<Contact>(endpoints.contacts.delete(id));
    return response.data;
  },
  findDuplicates: async (): Promise<DuplicatesResponse> => {
    const response = await api.get<DuplicatesResponse>(
      endpoints.contacts.duplicates
    );
    return response.data;
  },
  merge: async (payload: {
    primaryId: string;
    duplicateId: string;
  }): Promise<Contact> => {
    const response = await api.post<Contact>(
      endpoints.contacts.merge,
      payload
    );
    return response.data;
  },
  assignTags: async (
    id: string,
    tagIds: string[]
  ): Promise<Array<{ contactId: string; tagId: string; createdAt: string; tag: Tag }>> => {
    const response = await api.post(endpoints.contacts.tags(id), {
      tagIds,
    });
    return response.data;
  },
  removeTags: async (
    id: string,
    tagIds: string[]
  ): Promise<unknown> => {
    const response = await api.delete(endpoints.contacts.tags(id), {
      data: { tagIds },
    });
    return response.data;
  },
  getCustomFieldValues: async (
    id: string
  ): Promise<CustomFieldValue[]> => {
    const response = await api.get<CustomFieldValue[]>(
      endpoints.contacts.customFields(id)
    );
    return response.data;
  },
  setCustomFieldValues: async (
    id: string,
    fields: Array<{ fieldId: string; value: string }>
  ): Promise<CustomFieldValue[]> => {
    const response = await api.put<CustomFieldValue[]>(
      endpoints.contacts.customFields(id),
      { fields }
    );
    return response.data;
  },
  listNotes: async (id: string): Promise<ContactNote[]> => {
    const response = await api.get<ContactNote[]>(
      endpoints.contacts.notes(id)
    );
    return response.data;
  },
  createNote: async (
    id: string,
    content: string
  ): Promise<ContactNote> => {
    const response = await api.post<ContactNote>(
      endpoints.contacts.notes(id),
      { content }
    );
    return response.data;
  },
  deleteNote: async (id: string, noteId: string): Promise<void> => {
    await api.delete(endpoints.contacts.noteById(id, noteId));
  },
  getTimeline: async (
    id: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<TimelineResponse> => {
    const response = await api.get<TimelineResponse>(
      endpoints.contacts.timeline(id),
      { params }
    );
    return response.data;
  },
};

export const tagsApi = {
  list: async (): Promise<Tag[]> => {
    const response = await api.get<Tag[]>(endpoints.tags.list);
    return response.data;
  },
  getOne: async (id: string): Promise<Tag> => {
    const response = await api.get<Tag>(endpoints.tags.byId(id));
    return response.data;
  },
  create: async (data: {
    name: string;
    color?: string;
  }): Promise<Tag> => {
    const response = await api.post<Tag>(endpoints.tags.create, data);
    return response.data;
  },
  update: async (
    id: string,
    data: { name?: string; color?: string }
  ): Promise<Tag> => {
    const response = await api.put<Tag>(endpoints.tags.byId(id), data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(endpoints.tags.byId(id));
  },
};

export const customFieldsApi = {
  list: async (): Promise<CustomFieldDef[]> => {
    const response = await api.get<CustomFieldDef[]>(
      endpoints.customFields.list
    );
    return response.data;
  },
  getOne: async (id: string): Promise<CustomFieldDef> => {
    const response = await api.get<CustomFieldDef>(
      endpoints.customFields.byId(id)
    );
    return response.data;
  },
  create: async (data: {
    name: string;
    label: string;
    type?: string;
    isRequired?: boolean;
  }): Promise<CustomFieldDef> => {
    const response = await api.post<CustomFieldDef>(
      endpoints.customFields.create,
      data
    );
    return response.data;
  },
  update: async (
    id: string,
    data: { label?: string; type?: string; isRequired?: boolean }
  ): Promise<CustomFieldDef> => {
    const response = await api.put<CustomFieldDef>(
      endpoints.customFields.byId(id),
      data
    );
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(endpoints.customFields.byId(id));
  },
};

export const segmentsApi = {
  list: async (): Promise<Segment[]> => {
    const response = await api.get<Segment[]>(endpoints.segments.list);
    return response.data;
  },
  getOne: async (id: string): Promise<Segment> => {
    const response = await api.get<Segment>(endpoints.segments.byId(id));
    return response.data;
  },
  create: async (data: {
    name: string;
    description?: string;
    query: SegmentQuery;
  }): Promise<Segment> => {
    const response = await api.post<Segment>(endpoints.segments.create, data);
    return response.data;
  },
  update: async (
    id: string,
    data: { name?: string; description?: string; query?: SegmentQuery }
  ): Promise<Segment> => {
    const response = await api.put<Segment>(
      endpoints.segments.byId(id),
      data
    );
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(endpoints.segments.byId(id));
  },
  preview: async (id: string): Promise<SegmentPreviewResponse> => {
    const response = await api.get<SegmentPreviewResponse>(
      endpoints.segments.preview(id)
    );
    return response.data;
  },
};

export const templatesApi = {
  list: async (params?: {
    q?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<TemplatesListResponse> => {
    const response = await api.get<TemplatesListResponse>(
      endpoints.templates.list,
      { params }
    );
    return response.data;
  },
  get: async (id: string): Promise<Template> => {
    const response = await api.get<Template>(endpoints.templates.byId(id));
    return response.data;
  },
  getLimits: async (): Promise<TemplateLimitsResponse> => {
    const response = await api.get<TemplateLimitsResponse>(
      endpoints.templates.limits
    );
    return response.data;
  },
  create: async (data: {
    name: string;
    description?: string;
    groupKey?: string;
  }): Promise<Template> => {
    const response = await api.post<Template>(endpoints.templates.create, data);
    return response.data;
  },
  update: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<Template> => {
    const response = await api.put<Template>(
      endpoints.templates.update(id),
      data
    );
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(endpoints.templates.remove(id));
  },
  addWhatsApp: async (
    id: string,
    data?: { category?: TemplateCategory }
  ): Promise<{ id: string; templateId: string; channel: string }> => {
    const response = await api.post(endpoints.templates.addWhatsApp(id), data ?? {});
    return response.data as { id: string; templateId: string; channel: string };
  },
  metaImportPreview: async (): Promise<{
    items: Array<{
      providerTemplateId: string;
      name: string;
      language: string;
      category: string;
      status: string;
      action: "create" | "link" | "skip";
      reason?: string;
    }>;
  }> => {
    const response = await api.get(endpoints.templates.metaImportPreview);
    return response.data;
  },
  metaImport: async (providerTemplateIds?: string[]): Promise<{
    total: number;
    templatesCreated: number;
    channelTemplatesCreated: number;
    versionsCreated: number;
    linked: number;
    skipped: number;
    errors: Array<{ providerTemplateId: string; name: string; error: string }>;
  }> => {
    const response = await api.post(endpoints.templates.metaImport, {
      providerTemplateIds,
    });
    return response.data;
  },
};

export const channelTemplatesApi = {
  state: async (id: string): Promise<ChannelTemplateState> => {
    const response = await api.get<ChannelTemplateState>(
      endpoints.channelTemplates.state(id)
    );
    return response.data;
  },
  update: async (
    id: string,
    data: { category: TemplateCategory }
  ): Promise<any> => {
    const response = await api.put(endpoints.channelTemplates.update(id), data);
    return response.data as any;
  },
  listVersions: async (id: string): Promise<ChannelTemplateVersion[]> => {
    const response = await api.get<ChannelTemplateVersion[]>(
      endpoints.channelTemplates.versions(id)
    );
    return response.data;
  },
  createVersion: async (
    id: string,
    data: ChannelTemplateVersionPayload
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.post<ChannelTemplateVersion>(
      endpoints.channelTemplates.versions(id),
      data
    );
    return response.data;
  },
  getVersion: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.get<ChannelTemplateVersion>(
      endpoints.channelTemplates.version(id, version)
    );
    return response.data;
  },
  updateVersion: async (
    id: string,
    version: number,
    data: ChannelTemplateVersionUpdatePayload
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.put<ChannelTemplateVersion>(
      endpoints.channelTemplates.updateVersion(id, version),
      data
    );
    return response.data;
  },
  activate: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.post<ChannelTemplateVersion>(
      endpoints.channelTemplates.activate(id, version)
    );
    return response.data;
  },
  submit: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.post<ChannelTemplateVersion>(
      endpoints.channelTemplates.submit(id, version)
    );
    return response.data;
  },
  approve: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.post<ChannelTemplateVersion>(
      endpoints.channelTemplates.approve(id, version)
    );
    return response.data;
  },
  reject: async (
    id: string,
    version: number,
    reason: string
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.post<ChannelTemplateVersion>(
      endpoints.channelTemplates.reject(id, version),
      { reason }
    );
    return response.data;
  },
  archive: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateVersion> => {
    const response = await api.put<ChannelTemplateVersion>(
      endpoints.channelTemplates.archive(id, version)
    );
    return response.data;
  },
  sync: async (
    id: string,
    version: number
  ): Promise<ChannelTemplateSyncResult> => {
    const response = await api.post<ChannelTemplateSyncResult>(
      endpoints.channelTemplates.sync(id, version)
    );
    return response.data;
  },
  refreshProvider: async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post<{ success: boolean; error?: string }>(
      endpoints.channelTemplates.refreshProvider(id)
    );
    return response.data;
  },
};

export const campaignsApi = {
  list: async (params?: {
    status?: string;
    channel?: string;
    isActive?: boolean;
  }) => {
    const response = await api.get(endpoints.campaigns.list, { params });
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post(endpoints.campaigns.create, data);
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(endpoints.campaigns.byId(id));
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(endpoints.campaigns.update(id), data);
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(endpoints.campaigns.remove(id));
    return response.data;
  },
  start: async (id: string) => {
    const response = await api.post(endpoints.campaigns.start(id));
    return response.data;
  },
  pause: async (id: string) => {
    const response = await api.post(endpoints.campaigns.pause(id));
    return response.data;
  },
  resume: async (id: string) => {
    const response = await api.post(endpoints.campaigns.resume(id));
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(endpoints.campaigns.cancel(id));
    return response.data;
  },
  /** Remove stuck jobs from Redis only; use cancel for a full stop + DB update. */
  drainQueue: async (id: string) => {
    const response = await api.post(endpoints.campaigns.drainQueue(id));
    return response.data as { campaignId: string; removedFromQueue: number };
  },
  duplicate: async (id: string) => {
    const response = await api.post(endpoints.campaigns.duplicate(id));
    return response.data;
  },
  progress: async (id: string, runId?: string) => {
    const response = await api.get(endpoints.campaigns.progress(id), {
      params: runId ? { runId } : undefined,
    });
    return response.data;
  },
  runs: async (id: string) => {
    const response = await api.get(endpoints.campaigns.runs(id));
    return response.data;
  },
  runJobs: async (id: string, runId: string) => {
    const response = await api.get(endpoints.campaigns.runJobs(id, runId));
    return response.data;
  },
  contacts: async (
    id: string,
    params?: { status?: string; search?: string; limit?: number; cursor?: string },
  ) => {
    const response = await api.get(endpoints.campaigns.contacts(id), { params });
    return response.data;
  },
};

export interface MediaUploadForTemplateResponse {
  assetHandle: string;
}

// Resumable upload types
export interface InitUploadBody {
  file_name: string;
  file_length: number;
  file_type: string;
}

export interface InitUploadResponse {
  uploadSessionId: string;
  file_length: number;
  expires_at: string;
}

export type UploadBytesResponse =
  | { assetHandle?: string; mediaId?: string }
  | { bytes_received: number };

export interface UploadSessionStatus {
  uploadSessionId: string;
  file_length: number;
  bytes_received: number;
  expires_at: string;
  state: "uploading" | "completed";
}

/** Nest / OpenAPI may use snake_case or camelCase; avoid defaulting to 0 when the key is missing. */
function parseBytesReceivedFromPayload(data: unknown): number | undefined {
  if (data == null || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const candidates = [
    o.bytes_received,
    o.bytesReceived,
    o.newTotal,
    o.totalBytes,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    for (const k of ["bytes_received", "bytesReceived", "newTotal"]) {
      const v = inner[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return undefined;
}

export const meApi = {
  updateProfile: async (data: { name?: string; avatarUrl?: string }) => {
    const response = await api.patch(endpoints.auth.meProfile, data);
    return response.data as { user: { id: string; email: string; name?: string; avatarUrl?: string; hasPassword?: boolean } };
  },
};

export const mediaApi = {
  list: async (params?: { limit?: number; cursor?: string }) => {
    const response = await api.get(endpoints.media.list, { params });
    return response.data;
  },
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(endpoints.media.upload, formData);
    return response.data;
  },
  uploadForTemplate: async (
    file: File
  ): Promise<MediaUploadForTemplateResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<MediaUploadForTemplateResponse>(
      endpoints.media.uploadForTemplate,
      formData
    );
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(endpoints.media.remove(id));
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(endpoints.media.byId(id));
    return response.data;
  },
  downloadUrl: (id: string) => `${API_BASE_URL}${endpoints.media.download(id)}`,
  downloadFile: async (id: string, fallbackName?: string): Promise<void> => {
    const response = await fetchWithAuthRefresh(endpoints.media.download(id));
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch =
      /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    const parsedName = fileNameMatch
      ? decodeURIComponent(fileNameMatch[1] || fileNameMatch[2] || "")
      : "";
    const fileName = parsedName || fallbackName || `media-${id}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  syncToProvider: async (id: string, provider: "whatsapp" | "telegram") => {
    const response = await api.post(endpoints.media.sync(id, provider));
    return response.data;
  },
  retryFailedSyncs: async () => {
    const response = await api.post(endpoints.media.retryFailed);
    return response.data;
  },
  prepareWhatsApp: async (
    mediaId: string
  ): Promise<PrepareWhatsAppResponseDto> => {
    const response = await api.post<PrepareWhatsAppResponseDto>(
      endpoints.media.prepareWhatsApp(mediaId)
    );
    return response.data;
  },
};

/**
 * Resumable file uploads (aligned with backend `express.raw` + session store).
 *
 * - Each chunk POST must use **`Content-Type: application/octet-stream`** (see `uploadBytes`).
 * - While the file is incomplete, **do not** send **zero-length** bodies (except the single
 *   request for a **0-byte** file, which completes in one call).
 * - **202** responses should carry monotonically increasing **`bytes_received`** until **200**.
 * - **`mediaId`** is always the stable reference when present; **`assetHandle`** may be omitted
 *   for MIME types that do not use Meta Graph resumable upload (see `whatsappCloudMedia.ts`).
 */
export const uploadsApi = {
  initUpload: async (
    body: InitUploadBody
  ): Promise<InitUploadResponse> => {
    const response = await api.post<InitUploadResponse>(
      endpoints.uploads.init,
      body
    );
    return response.data;
  },
  /**
   * Send one chunk via `fetch` (not axios) so the body is always raw bytes and
   * `Content-Type: application/octet-stream` is not merged with `application/json`.
   */
  uploadBytes: async (
    sessionId: string,
    chunk: ArrayBuffer
  ): Promise<
    | { status: 200; assetHandle?: string; mediaId?: string }
    | { status: 202; bytes_received: number }
  > => {
    const path = endpoints.uploads.session(sessionId);
    const body: BodyInit =
      chunk.byteLength === 0 ? new Blob([]) : new Uint8Array(chunk);

    const response = await fetchWithAuthRefresh(path, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/octet-stream" },
    });

    const text = await response.text();
    let json: unknown = {};
    if (text.length) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = {};
      }
    }

    /** 200 OK or 201 Created — both mean this chunk/session step completed successfully. */
    if (response.status === 200 || response.status === 201) {
      const d = json as { assetHandle?: string; mediaId?: string };
      return {
        status: 200,
        assetHandle: d.assetHandle,
        mediaId: d.mediaId,
      };
    }

    if (response.status === 202) {
      let br = parseBytesReceivedFromPayload(json);
      if (br == null) {
        try {
          const st = await uploadsApi.getSessionStatus(sessionId);
          br =
            parseBytesReceivedFromPayload(st) ??
            (typeof st.bytes_received === "number" ? st.bytes_received : undefined);
        } catch {
          br = undefined;
        }
      }
      return {
        status: 202,
        bytes_received: br ?? 0,
      };
    }

    const msg =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `Upload request failed (${response.status})`;
    throw new Error(msg);
  },
  /**
   * Sends bytes from `fullBuffer` starting at `offset` until the session returns 200.
   * Handles 202 partial responses by resuming from `bytes_received`.
   */
  uploadFullFile: async (
    sessionId: string,
    fullBuffer: ArrayBuffer,
    onProgress?: (bytesReceived: number, totalBytes: number) => void
  ): Promise<{ assetHandle: string; mediaId?: string }> => {
    const total = fullBuffer.byteLength;
    /** One empty body completes the session (0-byte file). */
    if (total === 0) {
      const res = await uploadsApi.uploadBytes(sessionId, new ArrayBuffer(0));
      if (res.status === 200) {
        const handle = res.assetHandle ?? "";
        if (!res.mediaId && !handle) {
          throw new Error("Upload completed without media reference");
        }
        onProgress?.(0, 0);
        return { assetHandle: handle, mediaId: res.mediaId };
      }
      throw new Error("Upload incomplete (please retry)");
    }

    let offset = 0;
    let guard = 0;
    const maxSteps = Math.max(128, total / 4096 + 48);
    while (guard++ < maxSteps) {
      const chunk = fullBuffer.slice(offset);

      if (chunk.byteLength === 0) {
        if (offset !== total) {
          throw new Error("Upload incomplete (please retry)");
        }
        /** Finalize: all bytes were accepted with 202 — many backends expect one more POST with an empty body. */
        const fin = await uploadsApi.uploadBytes(sessionId, new ArrayBuffer(0));
        if (fin.status === 200) {
          const handle = fin.assetHandle ?? "";
          if (!fin.mediaId && !handle) {
            throw new Error("Upload completed without media reference");
          }
          onProgress?.(total, total);
          return { assetHandle: handle, mediaId: fin.mediaId };
        }
        throw new Error("Upload incomplete (please retry)");
      }

      const res = await uploadsApi.uploadBytes(sessionId, chunk);
      if (res.status === 200) {
        const handle = res.assetHandle ?? "";
        if (!res.mediaId && !handle) {
          throw new Error("Upload completed without media reference");
        }
        onProgress?.(total, total);
        return { assetHandle: handle, mediaId: res.mediaId };
      }

      let br = res.bytes_received;
      if (br <= offset) {
        try {
          const st = await uploadsApi.getSessionStatus(sessionId);
          if (st.bytes_received > offset) br = st.bytes_received;
        } catch {
          /* ignore — stall handled below */
        }
      }
      if (br <= offset) {
        throw new Error(
          "Upload stalled (no progress). If this persists, check the network tab: each POST to the upload session must send raw bytes with Content-Type: application/octet-stream."
        );
      }
      offset = br;
      onProgress?.(Math.min(offset, total), total);
    }
    throw new Error("Upload took too many steps");
  },
  getSessionStatus: async (
    sessionId: string
  ): Promise<UploadSessionStatus> => {
    const response = await api.get<UploadSessionStatus>(
      endpoints.uploads.session(sessionId)
    );
    return response.data;
  },
  cancelSession: async (sessionId: string): Promise<void> => {
    await api.delete(endpoints.uploads.session(sessionId));
  },
};

export const opsApi = {
  queueMetrics: async () => {
    const response = await api.get(endpoints.metrics.queues);
    return response.data;
  },
};

export const analyticsApi = {
  summary: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.analytics.summary, { params });
    return response.data;
  },
  delivery: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.analytics.delivery, { params });
    return response.data;
  },
  channels: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.analytics.channels, { params });
    return response.data;
  },
  timeseries: async (params?: {
    start?: string;
    end?: string;
    granularity?: "hour" | "day" | "week";
  }) => {
    const response = await api.get(endpoints.analytics.timeseries, { params });
    return response.data;
  },
  /** Top / ranked campaigns for a date range (`GET /analytics/campaigns`). */
  campaigns: async (params?: {
    start?: string;
    end?: string;
    limit?: number;
  }) => {
    const response = await api.get(endpoints.analytics.campaigns, { params });
    return response.data;
  },
  /** Per-campaign analytics (`GET /analytics/campaigns/:id`). Shape is backend-defined. */
  campaignReport: async (id: string) => {
    const response = await api.get(endpoints.analytics.campaignById(id));
    return response.data;
  },
  /** Detailed campaign report with all sections. */
  campaignDetailed: async (id: string) => {
    const response = await api.get(endpoints.analytics.campaignDetailed(id));
    return response.data;
  },
  /** Download campaign contacts as CSV. */
  campaignExport: async (id: string): Promise<void> => {
    const res = await fetchWithAuthRefresh(endpoints.analytics.campaignExport(id));
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  conversations: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.analytics.conversations, { params });
    return response.data;
  },
  contacts: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.analytics.contacts, { params });
    return response.data;
  },
  agents: async (params: { start: string; end: string }) => {
    const response = await api.get(endpoints.analytics.agents, { params });
    return response.data;
  },
  agentActivity: async (id: string, params: { start: string; end: string }) => {
    const response = await api.get(endpoints.analytics.agentActivity(id), { params });
    return response.data;
  },
  templates: async (params: { start: string; end: string; templateId?: string }) => {
    const response = await api.get(endpoints.analytics.templates, { params });
    return response.data;
  },
  summaryByPeriod: async (period: "daily" | "weekly" | "monthly") => {
    const response = await api.get(endpoints.analytics.summaryByPeriod(period));
    return response.data;
  },
  exportCsv: async (params: {
    type: string;
    start: string;
    end: string;
  }): Promise<void> => {
    const qp = new URLSearchParams({
      type: params.type,
      start: params.start,
      end: params.end,
    });
    const res = await fetchWithAuthRefresh(
      `${endpoints.analytics.exportCsv}?${qp.toString()}`
    );
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${params.type}-${params.start}-${params.end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const usageApi = {
  current: async () => {
    const response = await api.get(endpoints.usage.current);
    return response.data;
  },
  limits: async () => {
    const response = await api.get(endpoints.usage.limits);
    return response.data;
  },
  checkMessages: async (count = 1) => {
    const response = await api.get(endpoints.usage.checkMessages, {
      params: { count },
    });
    return response.data;
  },
  checkContacts: async (count = 1) => {
    const response = await api.get(endpoints.usage.checkContacts, {
      params: { count },
    });
    return response.data;
  },
  period: async (params?: { start?: string; end?: string }) => {
    const response = await api.get(endpoints.usage.period, { params });
    return response.data;
  },
  storage: async () => {
    const response = await api.get(endpoints.usage.storage);
    return response.data;
  },
  rebuild: async () => {
    const response = await api.post(endpoints.usage.rebuild);
    return response.data;
  },
};

export const billingApi = {
  current: async (workspaceId: string) => {
    const response = await api.get(endpoints.billing.current(workspaceId));
    return response.data as BillingCurrentResponse;
  },
  subscribe: async (planId: string) => {
    const response = await api.post(endpoints.billing.subscribe, { planId });
    return response.data as {
      subscriptionId: string;
      shortUrl: string;
      status: string;
    };
  },
  cancel: async () => {
    const response = await api.post(endpoints.billing.cancel);
    return response.data as {
      subscriptionId: string;
      status: string;
      endsAt: string | null;
    };
  },
  subscription: async () => {
    const response = await api.get(endpoints.billing.subscription);
    return response.data as {
      subscription: {
        id: string;
        status: string;
        planId: string;
        currentStart: string | null;
        currentEnd: string | null;
        chargeAt: string;
        paidCount: number;
        shortUrl: string;
      } | null;
      configured: boolean;
    };
  },
};

export type BillingCurrentResponse = {
  plan: string;
  billingEmail: string | null;
  subscriptionId: string | null;
  planExpiresAt: string | null;
  billingCycleStart: string;
  billingCycleEnd: string;
  limits: {
    maxMessages: number;
    maxContacts: number;
    maxAgents: number;
    maxNumbers: number;
    maxStorageBytes: number;
  };
  usage: {
    messagesSent: number;
    messagesReceived: number;
    contactsCreated: number;
    mediaUploaded: number;
    templatesSent: number;
    campaignMessages: number;
  } | null;
};

export type CloudApiConnectionStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "ERROR"
  | "DISCONNECTED";

/** Matches Prisma `CloudApiOnboardingPhase` (WhatsApp Cloud API onboarding). */
export type WhatsAppOnboardingPhase =
  | "PENDING_CONNECT"
  | "CONNECTED"
  | "REGISTERING"
  | "REGISTERED"
  | "OTP_PENDING"
  | "VERIFIED"
  | "ACTIVE"
  | "FAILED";

export type VerificationCodeMethod = "SMS" | "VOICE";

export interface WorkspaceSettingsPayload {
  timezone?: string;
  locale?: string;
}

export interface WorkspaceCloudApiConfigPayload {
  phoneNumberId: string;
  wabaId: string;
  accessToken?: string;
}

export interface WorkspaceCloudApiConfigResponse {
  phoneNumberId: string;
  wabaId: string;
  hasAccessToken: boolean;
  tokenExpiresAt?: string | null;
  status: CloudApiConnectionStatus;
}

export type WhatsAppPhoneStatus = {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  verificationStatus?: string;
  status?: string;
};

export type CloudApiAccountStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "ERROR" | string;

/** GET /whatsapp/connection — default account summary (legacy single-number shape). */
export type WhatsAppConnectionSummary = {
  status: CloudApiConnectionStatus;
  connected: boolean;
  hasAccessToken: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  businessId?: string;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
  onboardingPhase?: WhatsAppOnboardingPhase;
  metaPhoneStatus?: string | null;
  metaVerificationStatus?: string | null;
  lastOnboardingSyncAt?: string | null;
  registrationPending?: boolean;
};

export type WhatsAppConnection = {
  id: string;
  workspaceId?: string;
  phoneNumberId: string;
  wabaId?: string;
  isDefault?: boolean;
  status?: CloudApiAccountStatus;
  tokenExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  onboardingPhase?: WhatsAppOnboardingPhase;
  metaVerificationStatus?: string | null;
  metaPhoneStatus?: string | null;
  lastOnboardingSyncAt?: string | null;
  /** True when Meta still needs Cloud API registration (PIN). */
  registrationPending?: boolean;
};

/** GET /whatsapp/onboarding-status/:phoneNumberId */
export type WhatsAppOnboardingStatus = {
  phone_number_id: string;
  onboarding_phase: WhatsAppOnboardingPhase;
  cloud_api_account_status: string;
  token_expires_at?: string | null;
  meta: {
    code_verification_status?: string;
    status?: string;
    display_phone_number?: string;
    quality_rating?: string;
    verified_name?: string;
  };
  webhooks_subscribed: boolean | null;
};

export const workspaceApi = {
  listUserWorkspaces: async (): Promise<WorkspaceWithRoleDto[]> => {
    const response = await api.get<WorkspaceWithRoleDto[]>(endpoints.workspaces.list);
    return response.data;
  },

  createWorkspace: async (body: CreateWorkspaceDto): Promise<unknown> => {
    const response = await api.post(endpoints.workspaces.list, body);
    return response.data;
  },

  getWorkspace: async (id: string) => {
    const response = await api.get(endpoints.workspaces.byId(id));
    return response.data;
  },

  updateWorkspace: async (id: string, body: UpdateWorkspaceDto) => {
    const response = await api.put(endpoints.workspaces.byId(id), body);
    return response.data;
  },

  deleteWorkspace: async (id: string): Promise<void> => {
    await api.delete(endpoints.workspaces.byId(id));
  },

  getMembers: async (id: string) => {
    const response = await api.get(endpoints.workspaces.members(id));
    return response.data;
  },

  addMember: async (
    workspaceId: string,
    body: { userId: string; role?: WorkspaceRole }
  ): Promise<WorkspaceMemberResponseDto> => {
    const response = await api.post<WorkspaceMemberResponseDto>(
      endpoints.workspaces.members(workspaceId),
      body
    );
    return response.data;
  },

  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    body: { role: WorkspaceRole }
  ): Promise<WorkspaceMemberResponseDto> => {
    const response = await api.put<WorkspaceMemberResponseDto>(
      endpoints.workspaces.memberRole(workspaceId, memberId),
      body
    );
    return response.data;
  },

  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    await api.delete(endpoints.workspaces.memberById(workspaceId, memberId));
  },

  getSettings: async (id: string) => {
    const response = await api.get(endpoints.workspaces.settings(id));
    return response.data;
  },
  /** TODO: BSP | Used for BSP WhatsApp fields (whatsapp*); also timezone/locale */
  updateSettings: async (
    id: string,
    data: Partial<WorkspaceSettingsPayload>
  ) => {
    const response = await api.put(endpoints.workspaces.settings(id), data);
    return response.data;
  },
  getCloudApiConfig: async (id: string) => {
    const response = await api.get(endpoints.workspaces.cloudApi(id));
    return response.data as WorkspaceCloudApiConfigResponse;
  },
  updateCloudApiConfig: async (
    id: string,
    data: WorkspaceCloudApiConfigPayload
  ) => {
    const response = await api.put(endpoints.workspaces.cloudApi(id), data);
    return response.data as WorkspaceCloudApiConfigResponse;
  },
};

export const whatsappApi = {
  fetchPhoneStatus: async (phoneNumberId: string): Promise<WhatsAppPhoneStatus> => {
    const response = await api.get<{ success: true; data: WhatsAppPhoneStatus }>(
      endpoints.whatsapp.phoneStatus(phoneNumberId)
    );
    return response.data.data;
  },

  listConnections: async (): Promise<WhatsAppConnection[]> => {
    const response = await api.get(endpoints.whatsapp.connections);
    const body = response.data as
      | { success: true; data: WhatsAppConnection[] }
      | WhatsAppConnection[];
    return Array.isArray(body) ? body : body.data;
  },

  getConnection: async (): Promise<WhatsAppConnectionSummary> => {
    const response = await api.get(endpoints.whatsapp.connection);
    const raw = response.data as
      | { success?: true; data: WhatsAppConnectionSummary }
      | WhatsAppConnectionSummary;
    if (raw && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
      return raw.data;
    }
    return raw as WhatsAppConnectionSummary;
  },

  disconnect: async (cloudApiAccountId: string): Promise<void> => {
    await api.post(endpoints.whatsapp.disconnect(cloudApiAccountId));
  },

  getOnboardingStatus: async (
    phoneNumberId: string
  ): Promise<WhatsAppOnboardingStatus> => {
    const response = await api.get<{
      success: true;
      data: WhatsAppOnboardingStatus;
    }>(endpoints.whatsapp.onboardingStatus(phoneNumberId));
    return response.data.data;
  },

  registerNumber: async (body: {
    phone_number_id: string;
    pin: string;
  }): Promise<{
    phone_number_id: string;
    onboarding_phase: WhatsAppOnboardingPhase;
    meta: { success: boolean };
  }> => {
    const response = await api.post<{
      success: true;
      data: {
        phone_number_id: string;
        onboarding_phase: WhatsAppOnboardingPhase;
        meta: { success: boolean };
      };
    }>(endpoints.whatsapp.registerNumber, body);
    return response.data.data;
  },

  requestVerificationCode: async (body: {
    phone_number_id: string;
    code_method: VerificationCodeMethod;
    language: string;
  }): Promise<{ phone_number_id: string; onboarding_phase: WhatsAppOnboardingPhase; otp_requested_at: string }> => {
    const response = await api.post<{
      success: true;
      data: {
        phone_number_id: string;
        onboarding_phase: WhatsAppOnboardingPhase;
        otp_requested_at: string;
      };
    }>(endpoints.whatsapp.requestVerificationCode, body);
    return response.data.data;
  },

  verifyNumber: async (body: {
    phone_number_id: string;
    code: string;
  }): Promise<{
    phone_number_id: string;
    onboarding_phase: WhatsAppOnboardingPhase;
    meta_code_verification_status?: string;
  }> => {
    const response = await api.post<{
      success: true;
      data: {
        phone_number_id: string;
        onboarding_phase: WhatsAppOnboardingPhase;
        meta_code_verification_status?: string;
      };
    }>(endpoints.whatsapp.verifyNumber, body);
    return response.data.data;
  },

  ensureSubscription: async (body: { phone_number_id: string }): Promise<{
    webhooks_subscribed: boolean;
  }> => {
    const response = await api.post<{
      success: true;
      data: { webhooks_subscribed: boolean };
    }>(endpoints.whatsapp.ensureSubscription, body);
    return response.data.data;
  },
};

export type IntegrationRecord = {
  id: string;
  workspaceId?: string;
  channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS" | string;
  name?: string;
  isActive?: boolean;
  isDefault?: boolean;
  status?: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export const integrationsApi = {
  list: async (): Promise<IntegrationRecord[]> => {
    const response = await api.get<IntegrationRecord[]>(endpoints.integrations.list);
    return response.data;
  },
  getById: async (id: string): Promise<IntegrationRecord> => {
    const response = await api.get<IntegrationRecord>(endpoints.integrations.byId(id));
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<IntegrationRecord> => {
    const response = await api.post<IntegrationRecord>(endpoints.integrations.list, data);
    return response.data;
  },
  update: async (
    id: string,
    data: Record<string, unknown>
  ): Promise<IntegrationRecord> => {
    const response = await api.put<IntegrationRecord>(endpoints.integrations.byId(id), data);
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(endpoints.integrations.byId(id));
  },
  setDefault: async (id: string): Promise<IntegrationRecord> => {
    const response = await api.post<IntegrationRecord>(
      endpoints.integrations.setDefault(id)
    );
    return response.data;
  },
  activate: async (id: string): Promise<IntegrationRecord> => {
    const response = await api.post<IntegrationRecord>(endpoints.integrations.activate(id));
    return response.data;
  },
  deactivate: async (id: string): Promise<IntegrationRecord> => {
    const response = await api.post<IntegrationRecord>(
      endpoints.integrations.deactivate(id)
    );
    return response.data;
  },
  setupWhatsApp: async (payload: Record<string, unknown>) => {
    const response = await api.post(endpoints.integrations.setupWhatsApp, payload);
    return response.data;
  },
  setupTelegram: async (payload: Record<string, unknown>) => {
    const response = await api.post(endpoints.integrations.setupTelegram, payload);
    return response.data;
  },
  setupEmail: async (payload: Record<string, unknown>) => {
    const response = await api.post(endpoints.integrations.setupEmail, payload);
    return response.data;
  },
  setupSms: async (payload: Record<string, unknown>) => {
    const response = await api.post(endpoints.integrations.setupSms, payload);
    return response.data;
  },
  getDefaultByChannel: async (
    channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS"
  ): Promise<IntegrationRecord> => {
    const response = await api.get<IntegrationRecord>(
      endpoints.integrations.defaultByChannel(channel)
    );
    return response.data;
  },
};

export interface PlatformWorkspacesListParams {
  status?: PlatformWorkspaceStatus;
  plan?: string;
  isSuspended?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformUsersListParams {
  search?: string;
  isActive?: boolean;
  platformRole?: PlatformRole;
  limit?: number;
  offset?: number;
}

export interface PlatformWebhookLogsParams {
  workspaceId?: string;
  provider?: string;
  processed?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformUsageEventsParams {
  workspaceId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformAuditLogsParams {
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export type PlatformLoginHistoryEntry = {
  id?: string;
  userId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type ConnectedClientBusiness = {
  id: string;
  name: string;
  verification_status?: string;
  business_status?: string;
  [key: string]: unknown;
};

export const platformApi = {
  listWorkspaces: async (
    params?: PlatformWorkspacesListParams
  ): Promise<OffsetPaginatedResponse<PlatformWorkspaceListItem>> => {
    const response = await api.get<OffsetPaginatedResponse<PlatformWorkspaceListItem>>(
      endpoints.platform.workspaces,
      { params }
    );
    return response.data;
  },
  getWorkspace: async (id: string): Promise<PlatformWorkspaceDetail> => {
    const response = await api.get<PlatformWorkspaceDetail>(
      endpoints.platform.workspaceById(id)
    );
    return response.data;
  },
  suspendWorkspace: async (
    id: string,
    reason?: string
  ): Promise<PlatformWorkspaceDetail> => {
    const response = await api.put<PlatformWorkspaceDetail>(
      endpoints.platform.suspendWorkspace(id),
      reason ? { reason } : {}
    );
    return response.data;
  },
  reactivateWorkspace: async (id: string): Promise<PlatformWorkspaceDetail> => {
    const response = await api.put<PlatformWorkspaceDetail>(
      endpoints.platform.reactivateWorkspace(id)
    );
    return response.data;
  },
  listUsers: async (
    params?: PlatformUsersListParams
  ): Promise<OffsetPaginatedResponse<PlatformUserListItem>> => {
    const response = await api.get<OffsetPaginatedResponse<PlatformUserListItem>>(
      endpoints.platform.users,
      { params }
    );
    return response.data;
  },
  getUser: async (id: string): Promise<PlatformUserDetail> => {
    const response = await api.get<PlatformUserDetail>(endpoints.platform.userById(id));
    return response.data;
  },
  getUserLoginHistory: async (
    id: string
  ): Promise<PlatformLoginHistoryEntry[]> => {
    const response = await api.get<PlatformLoginHistoryEntry[]>(
      endpoints.platform.userLoginHistory(id)
    );
    return response.data;
  },
  updateUserPlatformRole: async (
    id: string,
    role: PlatformRole
  ): Promise<Pick<PlatformUserDetail, "id" | "email" | "name" | "platformRole">> => {
    const response = await api.put<
      Pick<PlatformUserDetail, "id" | "email" | "name" | "platformRole">
    >(endpoints.platform.userPlatformRole(id), { role });
    return response.data;
  },
  listWebhookLogs: async (
    params?: PlatformWebhookLogsParams
  ): Promise<OffsetPaginatedResponse<PlatformWebhookLog>> => {
    const response = await api.get<OffsetPaginatedResponse<PlatformWebhookLog>>(
      endpoints.platform.webhookLogs,
      { params }
    );
    return response.data;
  },
  listUsageEvents: async (
    params?: PlatformUsageEventsParams
  ): Promise<OffsetPaginatedResponse<PlatformUsageEvent>> => {
    const response = await api.get<OffsetPaginatedResponse<PlatformUsageEvent>>(
      endpoints.platform.usageEvents,
      { params }
    );
    return response.data;
  },
  listAuditLogs: async (
    params?: PlatformAuditLogsParams
  ): Promise<OffsetPaginatedResponse<PlatformAdminAuditLog>> => {
    const response = await api.get<OffsetPaginatedResponse<PlatformAdminAuditLog>>(
      endpoints.platform.auditLogs,
      { params }
    );
    return response.data;
  },
  listConnectedClientBusinesses: async (): Promise<ConnectedClientBusiness[]> => {
    const response = await api.get<ConnectedClientBusiness[]>(
      endpoints.platform.connectedClientBusinesses
    );
    return response.data;
  },
  listChannelAccounts: async (): Promise<PlatformChannelAccount[]> => {
    const response = await api.get<PlatformChannelAccount[]>(
      endpoints.platform.channelAccounts
    );
    return response.data;
  },
  assignChannelAccount: async (
    id: string,
    workspaceId?: string | null
  ): Promise<PlatformChannelAccount> => {
    const body =
      workspaceId === undefined ? {} : { workspaceId: workspaceId ?? null };
    const response = await api.put<PlatformChannelAccount>(
      endpoints.platform.assignChannelAccount(id),
      body
    );
    return response.data;
  },
};

export const onboardingApi = {
  listOwnedWabas: async (): Promise<OnboardingWabaListResponse> => {
    const response = await api.get<OnboardingWabaListResponse>(
      endpoints.onboarding.wabaOwned
    );
    return response.data;
  },
  listClientWabas: async (): Promise<OnboardingWabaListResponse> => {
    const response = await api.get<OnboardingWabaListResponse>(
      endpoints.onboarding.wabaClient
    );
    return response.data;
  },
};

export interface CreateFeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  priority?: FeedbackPriority;
  attachments?: FeedbackAttachment[];
  metadata?: Record<string, unknown>;
}

export interface ListFeedbackParams {
  type?: FeedbackType;
  status?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export interface UpdateFeedbackPayload {
  status?: string;
  adminNote?: string;
}

export const feedbackApi = {
  list: async (params: ListFeedbackParams = {}): Promise<PaginatedFeedbackResponse> => {
    const response = await api.get<PaginatedFeedbackResponse>(
      endpoints.feedback.list,
      { params }
    );
    return response.data;
  },
  getById: async (id: string): Promise<FeedbackReport> => {
    const response = await api.get<FeedbackReport>(endpoints.feedback.byId(id));
    return response.data;
  },
  create: async (payload: CreateFeedbackPayload): Promise<FeedbackReport> => {
    const response = await api.post<FeedbackReport>(
      endpoints.feedback.list,
      payload
    );
    return response.data;
  },
  adminUpdate: async (id: string, payload: UpdateFeedbackPayload): Promise<FeedbackReport> => {
    const response = await api.patch<FeedbackReport>(
      endpoints.feedback.byId(id),
      payload
    );
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(endpoints.feedback.byId(id));
  },
  vote: async (id: string): Promise<{ voteCount: number; hasVoted: boolean }> => {
    const response = await api.post<{ voteCount: number; hasVoted: boolean }>(
      endpoints.feedback.vote(id)
    );
    return response.data;
  },
  unvote: async (id: string): Promise<{ voteCount: number; hasVoted: boolean }> => {
    const response = await api.delete<{ voteCount: number; hasVoted: boolean }>(
      endpoints.feedback.vote(id)
    );
    return response.data;
  },
};
