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
  /** Recurring prepaid commerce (merchant's end-customer subscriptions). */
  recurring: {
    products: `${P}/subscriptions/products`,
    productById: (id: string) => `${P}/subscriptions/products/${id}`,
    plans: `${P}/subscriptions/plans`,
    planById: (id: string) => `${P}/subscriptions/plans/${id}`,
    subscriptions: `${P}/subscriptions/subscriptions`,
    subscriptionById: (id: string) => `${P}/subscriptions/subscriptions/${id}`,
    subscriptionPause: (id: string) => `${P}/subscriptions/subscriptions/${id}/pause`,
    subscriptionResume: (id: string) => `${P}/subscriptions/subscriptions/${id}/resume`,
    subscriptionCancel: (id: string) => `${P}/subscriptions/subscriptions/${id}/cancel`,
    wallet: (contactId: string) => `${P}/subscriptions/contacts/${contactId}/wallet`,
    walletTopUp: (contactId: string) => `${P}/subscriptions/contacts/${contactId}/wallet/topup`,
    manifest: `${P}/subscriptions/manifest`,
    cycleStatus: (id: string) => `${P}/subscriptions/cycles/${id}/status`,
    triggerGenerate: `${P}/subscriptions/triggers/generate`,
    triggerLock: `${P}/subscriptions/triggers/lock`,
    settings: `${P}/subscriptions/settings`,
    branding: `${P}/subscriptions/branding`,
    deliveryWindows: `${P}/subscriptions/delivery-windows`,
    deliveryWindowById: (id: string) => `${P}/subscriptions/delivery-windows/${id}`,
    /** Per-merchant Razorpay connect (3B). */
    razorpayStatus: `${P}/subscriptions/razorpay/status`,
    razorpayConnect: `${P}/subscriptions/razorpay/connect`,
    razorpayDisconnect: `${P}/subscriptions/razorpay`,
    /** The webhook URL a merchant registers in their Razorpay dashboard. */
    razorpayWebhook: (workspaceId: string) => `${P}/subscriptions/webhooks/razorpay/${workspaceId}`,
    /** Public, unauthenticated storefront (QR/link). `h` = storefront handle. */
    public: {
      catalog: (h: string) => `${P}/subscriptions/public/${h}/catalog`,
      otpRequest: (h: string) => `${P}/subscriptions/public/${h}/otp/request`,
      otpVerify: (h: string) => `${P}/subscriptions/public/${h}/otp/verify`,
      me: (h: string) => `${P}/subscriptions/public/${h}/me`,
      subscribe: (h: string) => `${P}/subscriptions/public/${h}/subscribe`,
      subscriptionById: (h: string, id: string) =>
        `${P}/subscriptions/public/${h}/subscriptions/${id}`,
      skip: (h: string, id: string) => `${P}/subscriptions/public/${h}/subscriptions/${id}/skip`,
      pause: (h: string, id: string) => `${P}/subscriptions/public/${h}/subscriptions/${id}/pause`,
      resume: (h: string, id: string) => `${P}/subscriptions/public/${h}/subscriptions/${id}/resume`,
      cancel: (h: string, id: string) => `${P}/subscriptions/public/${h}/subscriptions/${id}/cancel`,
      pay: (h: string, id: string) => `${P}/subscriptions/public/${h}/subscriptions/${id}/pay`,
    },
  },
  auth: {
    login: `${P}/auth/login`,
    register: `${P}/auth/register`,
    /** GET — link from verification email; API redirects to the app login. */
    verifyEmail: `${P}/auth/verify-email`,
    resendVerification: `${P}/auth/resend-verification`,
    /** GET — browser navigates to API; API redirects to Google, then back to `/v2/auth/google/callback`, then to the app. */
    googleStart: `${P}/auth/google`,
    me: `${P}/me`,
    meProfile: `${P}/me/profile`,
    mePreferences: `${P}/me/preferences`,
    refresh: `${P}/auth/refresh`,
    logout: `${P}/auth/logout`,
    logoutAll: `${P}/auth/logout-all`,
    forgotPassword: `${P}/auth/forgot-password`,
    resetPassword: `${P}/auth/reset-password`,
    changePassword: `${P}/auth/change-password`,
    setPassword: `${P}/auth/set-password`,
    selectWorkspace: `${P}/auth/select-workspace`,
    loginHistory: `${P}/auth/login-history`,
    /** POST — authed; mints a single-use code for the desktop browser-login handoff. */
    desktopAuthorize: `${P}/auth/desktop/authorize`,
  },
  backgroundTasks: {
    active: `${P}/background-tasks/active`,
  },
  workspaces: {
    list: `${P}/workspaces`,
    byId: (id: string) => `${P}/workspaces/${id}`,
    members: (id: string) => `${P}/workspaces/${id}/members`,
    membersByEmail: (id: string) => `${P}/workspaces/${id}/members/by-email`,
    memberRole: (id: string, memberId: string) =>
      `${P}/workspaces/${id}/members/${memberId}/role`,
    memberById: (id: string, memberId: string) =>
      `${P}/workspaces/${id}/members/${memberId}`,
    transferOwnership: (id: string) =>
      `${P}/workspaces/${id}/transfer-ownership`,
    settings: (id: string) => `${P}/workspaces/${id}/settings`,
    cloudApi: (id: string) => `${P}/workspaces/${id}/cloud-api`,
    messagingConfig: (id: string) => `${P}/workspaces/${id}/messaging-config`,
  },
  apiKeys: {
    list: `${P}/api-keys`,
    create: `${P}/api-keys`,
    revoke: (id: string) => `${P}/api-keys/${id}`,
  },
  workspaceInvitations: {
    list: `${P}/workspace-invitations`,
    create: `${P}/workspace-invitations`,
    revoke: (id: string) => `${P}/workspace-invitations/${id}`,
  },
  invitations: {
    lookup: (token: string) => `${P}/invitations/${token}`,
    accept: (token: string) => `${P}/invitations/${token}/accept`,
  },
  webhookEndpoints: {
    list: `${P}/webhook-endpoints`,
    create: `${P}/webhook-endpoints`,
    byId: (id: string) => `${P}/webhook-endpoints/${id}`,
    rotateSecret: (id: string) => `${P}/webhook-endpoints/${id}/rotate-secret`,
    test: (id: string) => `${P}/webhook-endpoints/${id}/test`,
    verify: (id: string) => `${P}/webhook-endpoints/${id}/verify`,
    deliveries: (id: string) => `${P}/webhook-endpoints/${id}/deliveries`,
  },
  webhookDeliveries: {
    byId: (id: string) => `${P}/webhook-deliveries/${id}`,
    replay: (id: string) => `${P}/webhook-deliveries/${id}/replay`,
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
    claim: (id: string) => `${P}/conversations/${id}/claim`,
    release: (id: string) => `${P}/conversations/${id}/release`,
    resetAi: (id: string) => `${P}/conversations/${id}/reset-ai`,
    handoffAi: (id: string) => `${P}/conversations/${id}/handoff-ai`,
  },
  messages: {
    listByConversation: (conversationId: string) =>
      `${P}/messages/conversation/${conversationId}`,
    pinnedByConversation: (conversationId: string) =>
      `${P}/messages/conversation/${conversationId}/pinned`,
    mediaByConversation: (conversationId: string) =>
      `${P}/messages/conversation/${conversationId}/media`,
    search: `${P}/messages/search`,
    send: `${P}/messages`,
    policy: (contactId: string) => `${P}/messages/policy/${contactId}`,
    byId: (id: string) => `${P}/messages/${id}`,
    updateStatus: (id: string) => `${P}/messages/${id}/status`,
    pin: (id: string) => `${P}/messages/${id}/pin`,
    star: (id: string) => `${P}/messages/${id}/star`,
    react: (id: string) => `${P}/messages/${id}/react`,
    retry: (id: string) => `${P}/messages/${id}/retry`,
    starred: `${P}/messages/starred`,
    scheduled: `${P}/messages/scheduled`,
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
    importGoogleSheet: `${P}/contacts/import/google-sheet`,
    importJob: (id: string) => `${P}/contacts/import/jobs/${id}`,
    importJobCancel: (id: string) => `${P}/contacts/import/jobs/${id}/cancel`,
    export: `${P}/contacts/export`,
    byId: (id: string) => `${P}/contacts/${id}`,
    consent: (id: string) => `${P}/contacts/${id}/consent`,
    delete: (id: string) => `${P}/contacts/${id}`,
    deleteAll: `${P}/contacts/all`,
    previewBulkDelete: `${P}/contacts/preview-delete`,
    bulkDelete: `${P}/contacts`,
    checkPhone: `${P}/contacts/check-phone`,
    duplicates: `${P}/contacts/duplicates`,
    merge: `${P}/contacts/merge`,
    tags: (id: string) => `${P}/contacts/${id}/tags`,
    customFields: (id: string) => `${P}/contacts/${id}/custom-fields`,
    notes: (id: string) => `${P}/contacts/${id}/notes`,
    noteById: (id: string, noteId: string) =>
      `${P}/contacts/${id}/notes/${noteId}`,
    memory: (id: string) => `${P}/contacts/${id}/memory`,
    memoryItem: (id: string, memoryId: string) =>
      `${P}/contacts/${id}/memory/${memoryId}`,
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
    refreshContent: (id: string) =>
      `${P}/channel-templates/${id}/provider/refresh-content`,
  },
  campaigns: {
    list: `${P}/campaigns`,
    create: `${P}/campaigns`,
    preview: `${P}/campaigns/preview`,
    byId: (id: string) => `${P}/campaigns/${id}`,
    update: (id: string) => `${P}/campaigns/${id}`,
    remove: (id: string) => `${P}/campaigns/${id}`,
    start: (id: string) => `${P}/campaigns/${id}/start`,
    pause: (id: string) => `${P}/campaigns/${id}/pause`,
    resume: (id: string) => `${P}/campaigns/${id}/resume`,
    cancel: (id: string) => `${P}/campaigns/${id}/cancel`,
    drainQueue: (id: string) => `${P}/campaigns/${id}/drain-queue`,
    recoverStuck: (id: string) => `${P}/campaigns/${id}/recover-stuck`,
    retryFailed: (id: string) => `${P}/campaigns/${id}/retry-failed`,
    failures: (id: string) => `${P}/campaigns/${id}/failures`,
    followUp: (id: string) => `${P}/campaigns/${id}/follow-up`,
    duplicate: (id: string) => `${P}/campaigns/${id}/duplicate`,
    progress: (id: string) => `${P}/campaigns/${id}/progress`,
    runs: (id: string) => `${P}/campaigns/${id}/runs`,
    runJobs: (id: string, runId: string) => `${P}/campaigns/${id}/runs/${runId}/jobs`,
    contacts: (id: string) => `${P}/campaigns/${id}/contacts`,
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
    campaignDetailed: (id: string) => `${P}/analytics/campaigns/${id}/detailed`,
    campaignExport: (id: string) => `${P}/analytics/campaigns/${id}/export`,
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
  },
  automation: {
    rules: `${P}/automation-rules`,
    ruleById: (id: string) => `${P}/automation-rules/${id}`,
    toggleRule: (id: string) => `${P}/automation-rules/${id}/toggle`,
    businessHours: `${P}/business-hours`,
  },
  flows: {
    list: `${P}/flows`,
    byId: (id: string) => `${P}/flows/${id}`,
    publish: (id: string) => `${P}/flows/${id}/publish`,
    unpublish: (id: string) => `${P}/flows/${id}/unpublish`,
  },
  knowledge: {
    list: `${P}/knowledge-docs`,
    byId: (id: string) => `${P}/knowledge-docs/${id}`,
    reembed: (id: string) => `${P}/knowledge-docs/${id}/reembed`,
    reembedAll: `${P}/knowledge-docs/reembed-all`,
  },
  cannedResponses: {
    list: `${P}/canned-responses`,
    create: `${P}/canned-responses`,
    byId: (id: string) => `${P}/canned-responses/${id}`,
    use: (id: string) => `${P}/canned-responses/${id}/use`,
  },
  tasks: {
    list: `${P}/tasks`,
    create: `${P}/tasks`,
    byId: (id: string) => `${P}/tasks/${id}`,
    complete: (id: string) => `${P}/tasks/${id}/complete`,
    snooze: (id: string) => `${P}/tasks/${id}/snooze`,
    reopen: (id: string) => `${P}/tasks/${id}/reopen`,
    counts: `${P}/tasks/counts`,
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
  auditLog: {
    list: `${P}/audit-log`,
  },
  platform: {
    overview: `${P}/platform/overview`,
    provisionWorkspace: `${P}/platform/provision-workspace`,
    failedSends: `${P}/platform/failed-sends`,
    workspaces: `${P}/platform/workspaces`,
    workspaceById: (id: string) => `${P}/platform/workspaces/${id}`,
    suspendWorkspace: (id: string) => `${P}/platform/workspaces/${id}/suspend`,
    reactivateWorkspace: (id: string) =>
      `${P}/platform/workspaces/${id}/reactivate`,
    restoreWorkspace: (id: string) => `${P}/platform/workspaces/${id}/restore`,
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
    reassignCloudApiAccount: (id: string) =>
      `${P}/platform/cloud-api-accounts/${id}/reassign`,
    assignChannelAccount: (id: string) =>
      `${P}/platform/channel-accounts/${id}/assign`,
    userResetLink: (id: string) => `${P}/platform/users/${id}/reset-link`,
    accessRequests: `${P}/platform/access-requests`,
    accessRequestsOpenCount: `${P}/platform/access-requests/open-count`,
    accessRequestById: (id: string) => `${P}/platform/access-requests/${id}`,
    accessRequestResetLink: (id: string) =>
      `${P}/platform/access-requests/${id}/reset-link`,
  },
  /** Public, unauthenticated account-recovery help requests. */
  accountAccess: {
    request: `${P}/account-access/request`,
  },
  onboarding: {
    wabaOwned: `${P}/onboarding/waba/owned`,
    wabaClient: `${P}/onboarding/waba/client`,
    sharingInfo: `${P}/onboarding/sharing-info`,
  },
  billing: {
    current: (workspaceId: string) =>
      `${P}/workspaces/${workspaceId}/billing/current`,
    subscribe: `${P}/billing/subscribe`,
    cancel: `${P}/billing/cancel`,
    subscription: `${P}/billing/subscription`,
    syncPlanLimits: `${P}/billing/sync-plan-limits`,
  },
  feedback: {
    list: `${P}/feedback`,
    byId: (id: string) => `${P}/feedback/${id}`,
    vote: (id: string) => `${P}/feedback/${id}/vote`,
  },
  /** Commerce — Meta product catalogs mirrored for WhatsApp. */
  commerce: {
    credential: `${P}/commerce/credential`,
    catalogs: `${P}/commerce/catalogs`,
    refreshCatalogs: `${P}/commerce/catalogs/refresh`,
    connectCatalog: (id: string) => `${P}/commerce/catalogs/${id}/connect`,
    syncCatalog: (id: string) => `${P}/commerce/catalogs/${id}/sync`,
    catalogSyncLogs: (id: string) => `${P}/commerce/catalogs/${id}/sync-logs`,
    products: `${P}/commerce/products`,
    productById: (id: string) => `${P}/commerce/products/${id}`,
  },
};
