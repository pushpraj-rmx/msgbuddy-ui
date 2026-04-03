/**
 * Axios `baseURL` for the Nest API. Paths in `endpoints` already start with `/v2/...`.
 *
 * The app UI is served at **`https://app.msgbuddy.com`**; the API is usually a separate host
 * (e.g. `https://api.msgbuddy.com`). Set `NEXT_PUBLIC_API_URL` to that API origin (no `/v2`
 * suffix here — paths add `/v2/...`). Do **not** duplicate `/api` in a way that produces
 * `/v2/api/...` unless your gateway expects it. `resolveMediaUrlForUi` resolves path-absolute
 * media paths (e.g. `/uploads/...` → `.../v2/uploads/...`).
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.msgbuddy.com";

const P = "/v2";

export const endpoints = {
  auth: {
    login: `${P}/auth/login`,
    register: `${P}/auth/register`,
    me: `${P}/me`,
    refresh: `${P}/auth/refresh`,
    logout: `${P}/auth/logout`,
    logoutAll: `${P}/auth/logout-all`,
  },
  workspaces: {
    list: `${P}/workspaces`,
    byId: (id: string) => `${P}/workspaces/${id}`,
    members: (id: string) => `${P}/workspaces/${id}/members`,
    memberRole: (id: string, memberId: string) =>
      `${P}/workspaces/${id}/members/${memberId}/role`,
    memberById: (id: string, memberId: string) =>
      `${P}/workspaces/${id}/members/${memberId}`,
    settings: (id: string) => `${P}/workspaces/${id}/settings`,
    cloudApi: (id: string) => `${P}/workspaces/${id}/cloud-api`,
    messagingConfig: (id: string) => `${P}/workspaces/${id}/messaging-config`,
  },
  conversations: {
    list: `${P}/conversations`,
    stats: `${P}/conversations/stats`,
    byId: (id: string) => `${P}/conversations/${id}`,
    byContact: (contactId: string) => `${P}/conversations/contact/${contactId}`,
    open: (id: string) => `${P}/conversations/${id}/open`,
    close: (id: string) => `${P}/conversations/${id}/close`,
    archive: (id: string) => `${P}/conversations/${id}/archive`,
    read: (id: string) => `${P}/conversations/${id}/read`,
    snooze: (id: string) => `${P}/conversations/${id}/snooze`,
    unsnooze: (id: string) => `${P}/conversations/${id}/unsnooze`,
    assign: (id: string) => `${P}/conversations/${id}/assign`,
    unassign: (id: string) => `${P}/conversations/${id}/unassign`,
    priority: (id: string) => `${P}/conversations/${id}/priority`,
    notes: (id: string) => `${P}/conversations/${id}/notes`,
    noteById: (id: string, noteId: string) => `${P}/conversations/${id}/notes/${noteId}`,
  },
  messages: {
    listByConversation: (conversationId: string) =>
      `${P}/messages/conversation/${conversationId}`,
    search: `${P}/messages/search`,
    send: `${P}/messages`,
    policy: (contactId: string) => `${P}/messages/policy/${contactId}`,
    byId: (id: string) => `${P}/messages/${id}`,
    updateStatus: (id: string) => `${P}/messages/${id}/status`,
  },
  integrations: {
    list: `${P}/integrations`,
    byId: (id: string) => `${P}/integrations/${id}`,
    defaultByChannel: (channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS") =>
      `${P}/integrations/default/${channel}`,
    setupWhatsApp: `${P}/integrations/setup/whatsapp`,
    setupTelegram: `${P}/integrations/setup/telegram`,
    setupEmail: `${P}/integrations/setup/email`,
    setupSms: `${P}/integrations/setup/sms`,
    setDefault: (id: string) => `${P}/integrations/${id}/set-default`,
    activate: (id: string) => `${P}/integrations/${id}/activate`,
    deactivate: (id: string) => `${P}/integrations/${id}/deactivate`,
  },
  contacts: {
    list: `${P}/contacts`,
    create: `${P}/contacts`,
    import: `${P}/contacts/import`,
    export: `${P}/contacts/export`,
    byId: (id: string) => `${P}/contacts/${id}`,
    consent: (id: string) => `${P}/contacts/${id}/consent`,
    delete: (id: string) => `${P}/contacts/${id}`,
    duplicates: `${P}/contacts/duplicates`,
    merge: `${P}/contacts/merge`,
    tags: (id: string) => `${P}/contacts/${id}/tags`,
    customFields: (id: string) => `${P}/contacts/${id}/custom-fields`,
    notes: (id: string) => `${P}/contacts/${id}/notes`,
    noteById: (id: string, noteId: string) =>
      `${P}/contacts/${id}/notes/${noteId}`,
    timeline: (id: string) => `${P}/contacts/${id}/timeline`,
  },
  tags: {
    list: `${P}/tags`,
    create: `${P}/tags`,
    byId: (id: string) => `${P}/tags/${id}`,
  },
  customFields: {
    list: `${P}/custom-fields`,
    create: `${P}/custom-fields`,
    byId: (id: string) => `${P}/custom-fields/${id}`,
  },
  segments: {
    list: `${P}/segments`,
    create: `${P}/segments`,
    byId: (id: string) => `${P}/segments/${id}`,
    preview: (id: string) => `${P}/segments/${id}/preview`,
  },
  templates: {
    list: `${P}/templates`,
    limits: `${P}/templates/limits`,
    create: `${P}/templates`,
    byId: (id: string) => `${P}/templates/${id}`,
    update: (id: string) => `${P}/templates/${id}`,
    remove: (id: string) => `${P}/templates/${id}`,
    addWhatsApp: (id: string) => `${P}/templates/${id}/channels/whatsapp`,
    metaImportPreview: `${P}/templates/provider/meta/import/preview`,
    metaImport: `${P}/templates/provider/meta/import`,
  },
  channelTemplates: {
    state: (id: string) => `${P}/channel-templates/${id}/state`,
    update: (id: string) => `${P}/channel-templates/${id}`,
    versions: (id: string) => `${P}/channel-templates/${id}/versions`,
    version: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}`,
    updateVersion: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}`,
    latestApproved: (id: string) =>
      `${P}/channel-templates/${id}/versions/latest/approved`,
    activate: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/activate`,
    submit: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/submit`,
    approve: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/approve`,
    reject: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/reject`,
    archive: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/archive`,
    sync: (id: string, version: number) =>
      `${P}/channel-templates/${id}/versions/${version}/sync`,
    refreshProvider: (id: string) => `${P}/channel-templates/${id}/provider/refresh`,
  },
  campaigns: {
    list: `${P}/campaigns`,
    create: `${P}/campaigns`,
    byId: (id: string) => `${P}/campaigns/${id}`,
    update: (id: string) => `${P}/campaigns/${id}`,
    remove: (id: string) => `${P}/campaigns/${id}`,
    start: (id: string) => `${P}/campaigns/${id}/start`,
    pause: (id: string) => `${P}/campaigns/${id}/pause`,
    resume: (id: string) => `${P}/campaigns/${id}/resume`,
    cancel: (id: string) => `${P}/campaigns/${id}/cancel`,
    duplicate: (id: string) => `${P}/campaigns/${id}/duplicate`,
    progress: (id: string) => `${P}/campaigns/${id}/progress`,
    runs: (id: string) => `${P}/campaigns/${id}/runs`,
    runJobs: (id: string, runId: string) => `${P}/campaigns/${id}/runs/${runId}/jobs`,
  },
  media: {
    public: `${P}/media/public`,
    list: `${P}/media`,
    upload: `${P}/media/upload`,
    uploadForTemplate: `${P}/media/upload-for-template`,
    byId: (id: string) => `${P}/media/${id}`,
    download: (id: string) => `${P}/media/${id}/download`,
    sync: (id: string, provider: "whatsapp" | "telegram") =>
      `${P}/media/${id}/sync/${provider}`,
    retryFailed: `${P}/media/retry-failed`,
    remove: (id: string) => `${P}/media/${id}`,
    /** POST — sync uploaded asset to WhatsApp Cloud API before send (idempotent). */
    prepareWhatsApp: (id: string) => `${P}/media/${id}/prepare-whatsapp`,
  },
  uploads: {
    init: `${P}/uploads/init`,
    session: (id: string) => `${P}/uploads/sessions/${id}`,
  },
  metrics: {
    queues: `${P}/metrics/queues`,
  },
  analytics: {
    summary: `${P}/analytics/summary`,
    delivery: `${P}/analytics/delivery`,
    channels: `${P}/analytics/channels`,
    timeseries: `${P}/analytics/timeseries`,
    campaigns: `${P}/analytics/campaigns`,
    campaignById: (id: string) => `${P}/analytics/campaigns/${id}`,
    conversations: `${P}/analytics/conversations`,
    contacts: `${P}/analytics/contacts`,
    agents: `${P}/analytics/agents`,
    agentActivity: (id: string) => `${P}/analytics/agents/${id}/activity`,
    templates: `${P}/analytics/templates`,
    summaryByPeriod: (period: string) => `${P}/analytics/summary/${period}`,
    exportCsv: `${P}/analytics/export`,
  },
  usage: {
    current: `${P}/usage`,
    limits: `${P}/usage/limits`,
    checkMessages: `${P}/usage/check/messages`,
    checkContacts: `${P}/usage/check/contacts`,
    period: `${P}/usage/period`,
    storage: `${P}/usage/storage`,
    rebuild: `${P}/usage/rebuild`,
  },
  internal: {
    notes: `${P}/internal/notes`,
    noteById: (id: string) => `${P}/internal/notes/${id}`,
    toggleNotePin: (id: string) => `${P}/internal/notes/${id}/toggle-pin`,
    messages: `${P}/internal/messages`,
    messagesByConversation: (conversationId: string) =>
      `${P}/internal/messages/${conversationId}`,
  },
  notifications: {
    list: `${P}/notifications`,
    unreadCount: `${P}/notifications/unread-count`,
    markRead: (id: string) => `${P}/notifications/${id}/read`,
    markAllRead: `${P}/notifications/read-all`,
  },
  presence: {
    viewConversation: (conversationId: string) =>
      `${P}/presence/conversations/${conversationId}/view`,
  },
  sse: {
    workspace: (workspaceId: string) => `${P}/sse/workspace/${workspaceId}`,
  },
  whatsapp: {
    exchangeCode: `${P}/whatsapp/exchange-code`,
    connection: `${P}/whatsapp/connection`,
    phoneStatus: (phoneNumberId: string) =>
      `${P}/channels/whatsapp/status/${encodeURIComponent(phoneNumberId)}`,
    connections: `${P}/whatsapp/connections`,
    disconnect: (cloudApiAccountId: string) =>
      `${P}/whatsapp/disconnect/${encodeURIComponent(cloudApiAccountId)}`,
    registerNumber: `${P}/whatsapp/register-number`,
    requestVerificationCode: `${P}/whatsapp/request-verification-code`,
    verifyNumber: `${P}/whatsapp/verify-number`,
    onboardingStatus: (phoneNumberId: string) =>
      `${P}/whatsapp/onboarding-status/${encodeURIComponent(phoneNumberId)}`,
    ensureSubscription: `${P}/whatsapp/ensure-subscription`,
  },
  platform: {
    workspaces: `${P}/platform/workspaces`,
    workspaceById: (id: string) => `${P}/platform/workspaces/${id}`,
    suspendWorkspace: (id: string) => `${P}/platform/workspaces/${id}/suspend`,
    reactivateWorkspace: (id: string) =>
      `${P}/platform/workspaces/${id}/reactivate`,
    users: `${P}/platform/users`,
    userById: (id: string) => `${P}/platform/users/${id}`,
    userLoginHistory: (id: string) => `${P}/platform/users/${id}/login-history`,
    userPlatformRole: (id: string) => `${P}/platform/users/${id}/platform-role`,
    webhookLogs: `${P}/platform/webhook-logs`,
    usageEvents: `${P}/platform/usage-events`,
    auditLogs: `${P}/platform/audit-logs`,
    connectedClientBusinesses: `${P}/platform/connected-client-businesses`,
    bspCredentials: `${P}/platform/bsp-credentials`,
    bspCredentialByBsp: (bsp: string) => `${P}/platform/bsp-credentials/${bsp}`,
    channelAccounts: `${P}/platform/channel-accounts`,
    assignChannelAccount: (id: string) =>
      `${P}/platform/channel-accounts/${id}/assign`,
  },
  onboarding: {
    wabaOwned: `${P}/onboarding/waba/owned`,
    wabaClient: `${P}/onboarding/waba/client`,
  },
};
