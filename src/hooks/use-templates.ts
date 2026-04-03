"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { templatesApi, channelTemplatesApi } from "@/lib/api";
import type {
  Template,
  ChannelTemplateState,
  ChannelTemplateVersion,
  ChannelTemplateVersionPayload,
  ChannelTemplateVersionUpdatePayload,
  TemplateCategory,
} from "@/lib/types";

export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: (params: TemplatesListParams) =>
    [...templateKeys.lists(), params] as const,
  limits: () => [...templateKeys.all, "limits"] as const,
  detail: (id: string) => [...templateKeys.all, "detail", id] as const,
};

export const channelTemplateKeys = {
  all: ["channelTemplates"] as const,
  state: (id: string) => [...channelTemplateKeys.all, "state", id] as const,
  versions: (id: string) => [...channelTemplateKeys.all, "versions", id] as const,
  version: (id: string, version: number) =>
    [...channelTemplateKeys.all, "version", id, version] as const,
};

export type TemplatesListParams = {
  q?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

const defaultListParams: TemplatesListParams = {
  page: 1,
  limit: 25,
  sortBy: "updatedAt",
  sortOrder: "desc",
};

export function useTemplatesList(params: TemplatesListParams = {}) {
  const merged = { ...defaultListParams, ...params };
  return useQuery({
    queryKey: templateKeys.list(merged),
    queryFn: () => templatesApi.list(merged),
  });
}

export function useTemplateLimits() {
  return useQuery({
    queryKey: templateKeys.limits(),
    queryFn: () => templatesApi.getLimits(),
  });
}

export function useTemplate(
  id: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: Query<Template>) => number | false | undefined);
  }
) {
  return useQuery<Template>({
    queryKey: templateKeys.detail(id ?? ""),
    queryFn: () => templatesApi.get(id!),
    enabled: !!id && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
    }) => templatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.limits() });
    },
  });
}

export function useChannelTemplateState(
  channelTemplateId: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<ChannelTemplateState>({
    queryKey: channelTemplateKeys.state(channelTemplateId ?? ""),
    queryFn: () => channelTemplatesApi.state(channelTemplateId!),
    enabled: !!channelTemplateId && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  });
}

export function useChannelTemplateVersions(
  channelTemplateId: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<ChannelTemplateVersion[]>({
    queryKey: channelTemplateKeys.versions(channelTemplateId ?? ""),
    queryFn: () => channelTemplatesApi.listVersions(channelTemplateId!),
    enabled: !!channelTemplateId && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  });
}

export function useChannelTemplateVersion(
  channelTemplateId: string | null,
  version: number | null,
  options?: { enabled?: boolean }
) {
  return useQuery<ChannelTemplateVersion>({
    queryKey: channelTemplateKeys.version(channelTemplateId ?? "", version ?? 0),
    queryFn: () => channelTemplatesApi.getVersion(channelTemplateId!, version!),
    enabled: !!channelTemplateId && version != null && version > 0 && (options?.enabled !== false),
  });
}

export function useCreateChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChannelTemplateVersionPayload }) =>
      channelTemplatesApi.createVersion(id, data),
    onSuccess: (data, variables) => {
      const ctId = data.channelTemplateId ?? variables.id;
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(ctId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(ctId, data.version) });
    },
  });
}

export function useUpdateChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      data,
    }: {
      id: string;
      version: number;
      data: ChannelTemplateVersionUpdatePayload;
    }) => channelTemplatesApi.updateVersion(id, version, data),
    onSuccess: (data, variables) => {
      const ctId = data.channelTemplateId ?? variables.id;
      const vNum = data.version ?? variables.version;
      // Apply server response immediately so UI matches DB (fixes stale cache / missed refetch).
      qc.setQueryData(channelTemplateKeys.version(ctId, vNum), data);
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(ctId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(ctId, vNum) });
    },
  });
}

export function useUpdateChannelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: TemplateCategory }) =>
      channelTemplatesApi.update(id, { category }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(variables.id) });
    },
  });
}

export function useActivateChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      channelTemplatesApi.activate(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(data.channelTemplateId) });
    },
  });
}

export function useSubmitChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      channelTemplatesApi.submit(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(data.channelTemplateId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(data.channelTemplateId, data.version) });
    },
  });
}

export function useApproveChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      channelTemplatesApi.approve(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(data.channelTemplateId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(data.channelTemplateId, data.version) });
    },
  });
}

export function useRejectChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, reason }: { id: string; version: number; reason: string }) =>
      channelTemplatesApi.reject(id, version, reason),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(data.channelTemplateId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(data.channelTemplateId, data.version) });
    },
  });
}

export function useArchiveChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      channelTemplatesApi.archive(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(data.channelTemplateId) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.version(data.channelTemplateId, data.version) });
    },
  });
}

export function useSyncChannelTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      channelTemplatesApi.sync(id, version),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(variables.id) });
      qc.invalidateQueries({
        queryKey: channelTemplateKeys.version(variables.id, variables.version),
      });
    },
  });
}

export function useRefreshChannelTemplateProviderState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => channelTemplatesApi.refreshProvider(id),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: channelTemplateKeys.state(variables.id) });
      qc.invalidateQueries({ queryKey: channelTemplateKeys.versions(variables.id) });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        isActive?: boolean;
      };
    }) => templatesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) });
    },
  });
}

export function useRemoveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.limits() });
    },
  });
}
