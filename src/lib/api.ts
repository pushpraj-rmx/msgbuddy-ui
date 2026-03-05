import api from "./axios";
import { API_BASE_URL, endpoints } from "./endpoints";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth";
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
  Template,
  TemplateVersion,
  TemplatesListResponse,
  TemplateSyncResponse,
  TemplateImportResponse,
  TemplateLimitsResponse,
  TemplateChannel,
  TemplateCategory,
  TemplateVersionPayload,
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
  PlatformBspCredential,
  PlatformBsp,
  PlatformChannelAccount,
  OnboardingWabaListResponse,
} from "./types";

export type {
  Template,
  TemplateVersion,
  TemplateChannel,
  TemplateCategory,
};

export interface RegisterRequest {
  email: string;
  password: string;
  workspace: string;
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

export interface User {
  id: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
}

export interface MeResponse {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole | string;
  platformRole: PlatformRole;
}

async function refreshServerAccessToken(
  cookieStore: Awaited<ReturnType<typeof import("next/headers").cookies>>
): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.refresh}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) return null;

    const { accessToken, refreshToken, expiresIn } =
      (await response.json()) as Partial<AuthResponse>;

    if (!accessToken) return null;

    const maxAge = expiresIn ?? 15 * 60;
    if (typeof cookieStore.set === "function") {
      cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge,
      });

      if (refreshToken) {
        cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
          path: "/",
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    }

    return accessToken;
  } catch {
    return null;
  }
}

export async function serverFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;

  const doRequest = async (bearer: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: bearer ? `Bearer ${bearer}` : "",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      credentials: "include",
    });

  let response = await doRequest(token);

  if (response.status === 401) {
    const refreshed = await refreshServerAccessToken(cookieStore);
    if (refreshed) {
      response = await doRequest(refreshed);
    } else {
      redirect("/login");
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(endpoints.auth.register, data, {
      withCredentials: true,
    });
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(endpoints.auth.login, data, {
      withCredentials: true,
    });
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
  limit?: number;
  cursor?: string;
}

export const conversationsApi = {
  list: async (params: ConversationFilters = {}) => {
    const response = await api.get(endpoints.conversations.list, { params });
    return response.data;
  },
  messages: async (conversationId: string) => {
    const response = await api.get(
      endpoints.messages.listByConversation(conversationId)
    );
    return response.data;
  },
  sendMessage: async (data: {
    contactId: string;
    text: string;
    idempotencyKey?: string;
    channel?: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  }) => {
    const response = await api.post(endpoints.messages.send, data);
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
    email?: string;
    emailLabel?: string;
  }): Promise<Contact> => {
    const response = await api.post<Contact>(endpoints.contacts.create, data);
    return response.data;
  },
  importCsv: async (
    file: File,
    options?: { defaultCountry?: string }
  ): Promise<ImportResult> => {
    const response = await api.postForm<ImportResult>(
      endpoints.contacts.import,
      { file },
      { params: { defaultCountry: options?.defaultCountry ?? "IN" } }
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
      email?: string;
      phoneLabel?: string;
      emailLabel?: string;
      isBlocked?: boolean;
      isOptedOut?: boolean;
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
    channel?: string;
    category?: string;
    isActive?: boolean;
    providerStatus?: string;
    hasProviderId?: boolean;
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
  get: async (id: string, params?: { include?: string }): Promise<Template> => {
    const response = await api.get<Template>(endpoints.templates.byId(id), {
      params,
    });
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
    channel?: TemplateChannel;
    category?: TemplateCategory;
  }): Promise<Template> => {
    const response = await api.post<Template>(endpoints.templates.create, data);
    return response.data;
  },
  update: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: TemplateCategory;
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
  refreshStatus: async (id: string): Promise<Template> => {
    const response = await api.post<Template>(
      endpoints.templates.refreshStatus(id)
    );
    return response.data;
  },
  importFromProvider: async (): Promise<TemplateImportResponse> => {
    const response = await api.post<TemplateImportResponse>(
      endpoints.templates.providerImport
    );
    return response.data;
  },
  getVersion: async (
    id: string,
    version: number
  ): Promise<TemplateVersion> => {
    const response = await api.get<TemplateVersion>(
      endpoints.templates.version(id, version)
    );
    return response.data;
  },
  latestApproved: async (id: string): Promise<TemplateVersion> => {
    const response = await api.get<TemplateVersion>(
      endpoints.templates.latestApproved(id)
    );
    return response.data;
  },
  createVersion: async (
    id: string,
    data: TemplateVersionPayload
  ): Promise<TemplateVersion> => {
    const response = await api.post<TemplateVersion>(
      endpoints.templates.createVersion(id),
      data
    );
    return response.data;
  },
  updateVersion: async (
    id: string,
    version: number,
    data: TemplateVersionPayload
  ): Promise<TemplateVersion> => {
    const response = await api.put<TemplateVersion>(
      endpoints.templates.version(id, version),
      data
    );
    return response.data;
  },
  submitVersion: async (
    id: string,
    version: number
  ): Promise<TemplateVersion> => {
    const response = await api.post<TemplateVersion>(
      endpoints.templates.submit(id, version)
    );
    return response.data;
  },
  approveVersion: async (
    id: string,
    version: number
  ): Promise<TemplateVersion> => {
    const response = await api.post<TemplateVersion>(
      endpoints.templates.approve(id, version)
    );
    return response.data;
  },
  rejectVersion: async (
    id: string,
    version: number,
    reason: string
  ): Promise<TemplateVersion> => {
    const response = await api.post<TemplateVersion>(
      endpoints.templates.reject(id, version),
      { reason }
    );
    return response.data;
  },
  syncVersion: async (
    id: string,
    version: number
  ): Promise<TemplateSyncResponse> => {
    const response = await api.post<TemplateSyncResponse>(
      endpoints.templates.sync(id, version)
    );
    return response.data;
  },
  archiveVersion: async (
    id: string,
    version: number
  ): Promise<TemplateVersion> => {
    const response = await api.put<TemplateVersion>(
      endpoints.templates.archiveVersion(id, version)
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
  progress: async (id: string, runId?: string) => {
    const response = await api.get(endpoints.campaigns.progress(id), {
      params: runId ? { runId } : undefined,
    });
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
  | { assetHandle: string }
  | { bytes_received: number };

export interface UploadSessionStatus {
  uploadSessionId: string;
  file_length: number;
  bytes_received: number;
  expires_at: string;
  state: "uploading" | "completed";
}

export const mediaApi = {
  list: async (params?: { limit?: number; cursor?: string }) => {
    const response = await api.get(endpoints.media.list, { params });
    return response.data;
  },
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(endpoints.media.upload, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  uploadForTemplate: async (
    file: File
  ): Promise<MediaUploadForTemplateResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<MediaUploadForTemplateResponse>(
      endpoints.media.uploadForTemplate,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(endpoints.media.remove(id));
    return response.data;
  },
};

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
  uploadBytes: async (
    sessionId: string,
    chunk: ArrayBuffer
  ): Promise<
    | { status: 200; assetHandle: string }
    | { status: 202; bytes_received: number }
  > => {
    const response = await api.post<UploadBytesResponse>(
      endpoints.uploads.session(sessionId),
      chunk,
      { headers: { "Content-Type": "application/octet-stream" } }
    );
    if (response.status === 200 && "assetHandle" in response.data) {
      return { status: 200, assetHandle: response.data.assetHandle };
    }
    return {
      status: 202,
      bytes_received:
        "bytes_received" in response.data ? response.data.bytes_received : 0,
    };
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
};

// TODO: BSP | Legacy provider; remove or keep when BSP support is finalized
export type WorkspaceProviderType = "BSP" | "CLOUD_API";
export type CloudApiConnectionStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "ERROR";

export interface WorkspaceSettingsPayload {
  timezone?: string;
  locale?: string;
  /** TODO: BSP | BSP WhatsApp credentials in workspace settings */
  whatsappPhoneNumberId?: string;
  whatsappBusinessId?: string;
  whatsappAccessToken?: string;
  whatsappWebhookSecret?: string;
}

export interface WorkspaceMessagingConfigPayload {
  providerType: WorkspaceProviderType;
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

export const workspaceApi = {
  getWorkspace: async (id: string) => {
    const response = await api.get(endpoints.workspaces.byId(id));
    return response.data;
  },
  getMembers: async (id: string) => {
    const response = await api.get(endpoints.workspaces.members(id));
    return response.data;
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
  getMessagingConfig: async (id: string) => {
    const response = await api.get(endpoints.workspaces.messagingConfig(id));
    return response.data as { providerType: WorkspaceProviderType };
  },
  updateMessagingConfig: async (
    id: string,
    data: WorkspaceMessagingConfigPayload
  ) => {
    const response = await api.put(
      endpoints.workspaces.messagingConfig(id),
      data
    );
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
  listBspCredentials: async (): Promise<PlatformBspCredential[]> => {
    const response = await api.get<PlatformBspCredential[]>(
      endpoints.platform.bspCredentials
    );
    return response.data;
  },
  upsertBspCredential: async (
    bsp: PlatformBsp,
    data: {
      credentials: Record<string, string>;
      webhookUrl?: string;
      webhookSecret?: string;
      isActive?: boolean;
    }
  ): Promise<PlatformBspCredential> => {
    const response = await api.put<PlatformBspCredential>(
      endpoints.platform.bspCredentialByBsp(bsp),
      data
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
