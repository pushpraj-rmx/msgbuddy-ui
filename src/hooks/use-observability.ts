"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { observabilityApi } from "@/lib/api";
import type {
  ObsFailuresParams,
  ObsProviderRequestsParams,
  ObsWebhooksParams,
} from "@/lib/observability-types";

export const observabilityKeys = {
  all: ["observability"] as const,
  webhooks: (p: ObsWebhooksParams) =>
    [...observabilityKeys.all, "webhooks", p] as const,
  webhook: (id: string) => [...observabilityKeys.all, "webhook", id] as const,
  providerRequests: (p: ObsProviderRequestsParams) =>
    [...observabilityKeys.all, "providerRequests", p] as const,
  providerRequest: (id: string) =>
    [...observabilityKeys.all, "providerRequest", id] as const,
  failures: (p: ObsFailuresParams) =>
    [...observabilityKeys.all, "failures", p] as const,
  timeline: (id: string) => [...observabilityKeys.all, "timeline", id] as const,
  search: (q: string) => [...observabilityKeys.all, "search", q] as const,
};

export function useObsWebhooks(params: ObsWebhooksParams) {
  return useQuery({
    queryKey: observabilityKeys.webhooks(params),
    queryFn: () => observabilityApi.listWebhooks(params),
  });
}

export function useObsWebhook(id: string | null) {
  return useQuery({
    queryKey: observabilityKeys.webhook(id ?? ""),
    queryFn: () => observabilityApi.getWebhook(id!),
    enabled: !!id,
  });
}

export function useRetryWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => observabilityApi.retryWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: observabilityKeys.all }),
  });
}

export function useObsProviderRequests(params: ObsProviderRequestsParams) {
  return useQuery({
    queryKey: observabilityKeys.providerRequests(params),
    queryFn: () => observabilityApi.listProviderRequests(params),
  });
}

export function useObsProviderRequest(id: string | null) {
  return useQuery({
    queryKey: observabilityKeys.providerRequest(id ?? ""),
    queryFn: () => observabilityApi.getProviderRequest(id!),
    enabled: !!id,
  });
}

export function useObsFailures(params: ObsFailuresParams) {
  return useQuery({
    queryKey: observabilityKeys.failures(params),
    queryFn: () => observabilityApi.listFailures(params),
  });
}

export function useMessageTimeline(id: string | null) {
  return useQuery({
    queryKey: observabilityKeys.timeline(id ?? ""),
    queryFn: () => observabilityApi.messageTimeline(id!),
    enabled: !!id,
  });
}

export function useRetryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => observabilityApi.retryMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: observabilityKeys.all }),
  });
}

export function useObsSearch(q: string) {
  return useQuery({
    queryKey: observabilityKeys.search(q),
    queryFn: () => observabilityApi.search(q),
    enabled: q.trim().length > 0,
  });
}
