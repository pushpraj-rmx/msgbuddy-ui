export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://v2.msgbuddy.com";

const P = "/api";

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
  },
  messages: {
    listByConversation: (conversationId: string) =>
      `${P}/messages/conversation/${conversationId}`,
    send: `${P}/messages`,
    byId: (id: string) => `${P}/messages/${id}`,
    updateStatus: (id: string) => `${P}/messages/${id}/status`,
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
    providerImport: `${P}/templates/provider/import`,
    byId: (id: string) => `${P}/templates/${id}`,
    update: (id: string) => `${P}/templates/${id}`,
    remove: (id: string) => `${P}/templates/${id}`,
    refreshStatus: (id: string) => `${P}/templates/${id}/refresh-status`,
    createVersion: (id: string) => `${P}/templates/${id}/versions`,
    version: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}`,
    latestApproved: (id: string) => `${P}/templates/${id}/versions/latest/approved`,
    submit: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}/submit`,
    approve: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}/approve`,
    reject: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}/reject`,
    sync: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}/sync`,
    archiveVersion: (id: string, version: number) =>
      `${P}/templates/${id}/versions/${version}/archive`,
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
    progress: (id: string) => `${P}/campaigns/${id}/progress`,
    runs: (id: string) => `${P}/campaigns/${id}/runs`,
  },
  media: {
    list: `${P}/media`,
    upload: `${P}/media/upload`,
    uploadForTemplate: `${P}/media/upload-for-template`,
    byId: (id: string) => `${P}/media/${id}`,
    remove: (id: string) => `${P}/media/${id}`,
  },
  uploads: {
    init: `${P}/uploads/init`,
    session: (id: string) => `${P}/uploads/sessions/${id}`,
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
  },
  sse: {
    workspace: (workspaceId: string) => `${P}/sse/workspace/${workspaceId}`,
  },
  whatsapp: {
    exchangeCode: `${P}/whatsapp/exchange-code`,
  },
  platform: {
    workspaces: `${P}/platform/workspaces`,
    workspaceById: (id: string) => `${P}/platform/workspaces/${id}`,
    suspendWorkspace: (id: string) => `${P}/platform/workspaces/${id}/suspend`,
    reactivateWorkspace: (id: string) =>
      `${P}/platform/workspaces/${id}/reactivate`,
    users: `${P}/platform/users`,
    userById: (id: string) => `${P}/platform/users/${id}`,
    userPlatformRole: (id: string) => `${P}/platform/users/${id}/platform-role`,
    webhookLogs: `${P}/platform/webhook-logs`,
    usageEvents: `${P}/platform/usage-events`,
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
