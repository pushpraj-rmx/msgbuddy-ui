/**
 * Wire types for the Developer Observability console API (`/v2/observability/*`).
 * Mirrors the shapes returned by the msgbuddy-v2 ObservabilityConsole controller.
 */

export type ObsProvider = "WHATSAPP" | "TELEGRAM" | "MSGBUDDY" | "EMAIL" | "SMS";

export interface ObsPage<T> {
  items: T[];
  total?: number;
  /** Failure Center returns `matched` (coarse) instead of `total`. */
  matched?: number;
  limit: number;
  offset: number;
}

export type WebhookStatus = "processed" | "failed" | "stuck" | "pending";

export interface ObsWebhookListItem {
  id: string;
  workspaceId: string | null;
  messageId: string | null;
  provider: ObsProvider;
  eventType: string | null;
  referenceId: string | null;
  processed: boolean;
  attempts: number;
  error: string | null;
  correlationId: string | null;
  createdAt: string;
  status: WebhookStatus;
  durationMs: number | null;
}

export interface ObsWebhookDetail extends ObsWebhookListItem {
  payload: unknown;
  headers: Record<string, string> | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
}

export interface ObsProviderRequestListItem {
  id: string;
  workspaceId: string | null;
  correlationId: string | null;
  messageId: string | null;
  provider: ObsProvider;
  operation: string;
  method: string;
  responseStatus: number | null;
  ok: boolean;
  durationMs: number;
  attempt: number;
  errorKind: string | null;
  errorCode: string | null;
  startedAt: string;
}

export interface ObsProviderRequestDetail extends ObsProviderRequestListItem {
  url: string;
  requestHeaders: Record<string, string> | null;
  requestBody: unknown;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  errorMessage: string | null;
  retryable: boolean | null;
  completedAt: string;
  createdAt: string;
}

export interface ObsFailureItem {
  source: string;
  id: string;
  workspaceId: string | null;
  occurredAt: string;
  title: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  failureClass?: string;
  retryable?: boolean;
  retryPath?: string | null;
  link?: string | null;
}

export interface ObsTimelineEvent {
  at: string;
  source: "message_event" | "provider_request" | "webhook";
  label: string;
  status?: string;
  refId: string;
  detail: Record<string, unknown>;
}

export interface ObsMessageTimeline {
  message: Record<string, unknown>;
  events: ObsTimelineEvent[];
}

export interface ObsSearchMatch {
  type: string;
  id: string;
  workspaceId?: string | null;
  summary: string;
  link: string | null;
}

export interface ObsSearchResult {
  query: string;
  identifierType: string;
  matches: ObsSearchMatch[];
  timeline?: ObsMessageTimeline | null;
}

export interface ObsWebhooksParams {
  limit?: number;
  offset?: number;
  workspaceId?: string;
  provider?: string;
  eventType?: string;
  processed?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface ObsProviderRequestsParams {
  limit?: number;
  offset?: number;
  workspaceId?: string;
  provider?: string;
  operation?: string;
  messageId?: string;
  ok?: string;
  from?: string;
  to?: string;
}

export interface ObsFailuresParams {
  limit?: number;
  offset?: number;
  workspaceId?: string;
  source?: string;
  from?: string;
  to?: string;
}
