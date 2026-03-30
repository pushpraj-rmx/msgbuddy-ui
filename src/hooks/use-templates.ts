"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { templatesApi } from "@/lib/api";
import type {
  Template,
  TemplateChannel,
  TemplateCategory,
  TemplateVersion,
  TemplateVersionPayload,
} from "@/lib/types";

export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: (params: TemplatesListParams) =>
    [...templateKeys.lists(), params] as const,
  limits: () => [...templateKeys.all, "limits"] as const,
  detail: (id: string) => [...templateKeys.all, "detail", id] as const,
  version: (id: string, version: number) =>
    [...templateKeys.all, "detail", id, "version", version] as const,
  latestApproved: (id: string) =>
    [...templateKeys.all, "detail", id, "latestApproved"] as const,
};

export type TemplatesListParams = {
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
    queryFn: () => templatesApi.get(id!, { include: "versions" }),
    enabled: !!id && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  });
}

export function useTemplateVersion(
  templateId: string | null,
  version: number | null,
  options?: {
    enabled?: boolean;
    refetchInterval?:
      | number
      | false
      | ((query: Query<TemplateVersion>) => number | false | undefined);
  }
) {
  return useQuery<TemplateVersion>({
    queryKey: templateKeys.version(templateId ?? "", version ?? 0),
    queryFn: () =>
      templatesApi.getVersion(templateId!, version!),
    enabled:
      !!templateId &&
      version != null &&
      version > 0 &&
      (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  });
}

export function useLatestApprovedVersion(
  templateId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: templateKeys.latestApproved(templateId ?? ""),
    queryFn: () => templatesApi.latestApproved(templateId!),
    enabled: !!templateId && (options?.enabled !== false),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      channel: TemplateChannel;
      category: TemplateCategory;
    }) => templatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.limits() });
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
        category?: TemplateCategory;
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

export function useImportTemplatesFromProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => templatesApi.importFromProvider(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.limits() });
    },
  });
}

export function useCreateTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: TemplateVersionPayload;
    }) => templatesApi.createVersion(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.invalidateQueries({ queryKey: templateKeys.limits() });
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
    },
  });
}

export function useUpdateTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      data,
    }: {
      id: string;
      version: number;
      data: TemplateVersionPayload;
    }) => templatesApi.updateVersion(id, version, data),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useSubmitTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      templatesApi.submitVersion(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useApproveTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      templatesApi.approveVersion(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useRejectTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      reason,
    }: {
      id: string;
      version: number;
      reason: string;
    }) => templatesApi.rejectVersion(id, version, reason),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useSyncTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      templatesApi.syncVersion(id, version),
    onSuccess: (_, { id, version }) => {
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) });
      qc.invalidateQueries({ queryKey: templateKeys.version(id, version) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useRefreshTemplateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.refreshStatus(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useArchiveTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      templatesApi.archiveVersion(id, version),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templateKeys.detail(data.templateId) });
      qc.invalidateQueries({
        queryKey: templateKeys.version(data.templateId, data.version),
      });
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
