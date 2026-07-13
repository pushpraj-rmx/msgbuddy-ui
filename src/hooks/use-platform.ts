"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  platformApi,
  type PlatformWebhookLogsParams,
  type PlatformUsageEventsParams,
  type PlatformUsersListParams,
  type PlatformWorkspacesListParams,
  type PlatformAuditLogsParams,
  type PlatformFailedSendsParams,
} from "@/lib/api";
import type {
  PlatformRole,
  AccountAccessRequestStatus,
} from "@/lib/types";

export const platformKeys = {
  all: ["platform"] as const,
  overview: () => [...platformKeys.all, "overview"] as const,
  failedSends: (params: PlatformFailedSendsParams) =>
    [...platformKeys.all, "failedSends", params] as const,
  workspaces: (params: PlatformWorkspacesListParams) =>
    [...platformKeys.all, "workspaces", params] as const,
  workspace: (id: string) => [...platformKeys.all, "workspace", id] as const,
  users: (params: PlatformUsersListParams) =>
    [...platformKeys.all, "users", params] as const,
  user: (id: string) => [...platformKeys.all, "user", id] as const,
  userLoginHistory: (id: string) =>
    [...platformKeys.all, "userLoginHistory", id] as const,
  webhookLogs: (params: PlatformWebhookLogsParams) =>
    [...platformKeys.all, "webhookLogs", params] as const,
  usageEvents: (params: PlatformUsageEventsParams) =>
    [...platformKeys.all, "usageEvents", params] as const,
  auditLogs: (params: PlatformAuditLogsParams) =>
    [...platformKeys.all, "auditLogs", params] as const,
  channelAccounts: () => [...platformKeys.all, "channelAccounts"] as const,
  connectedClientBusinesses: () =>
    [...platformKeys.all, "connectedClientBusinesses"] as const,
  accessRequests: (status?: AccountAccessRequestStatus) =>
    [...platformKeys.all, "accessRequests", status ?? "ALL"] as const,
  accessRequestsOpenCount: () =>
    [...platformKeys.all, "accessRequestsOpenCount"] as const,
};

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: () => platformApi.getOverview(),
  });
}

export function usePlatformFailedSends(params: PlatformFailedSendsParams) {
  return useQuery({
    queryKey: platformKeys.failedSends(params),
    queryFn: () => platformApi.listFailedSends(params),
  });
}

export function usePlatformWorkspaces(params: PlatformWorkspacesListParams) {
  return useQuery({
    queryKey: platformKeys.workspaces(params),
    queryFn: () => platformApi.listWorkspaces(params),
  });
}

export function usePlatformWorkspace(id: string | null) {
  return useQuery({
    queryKey: platformKeys.workspace(id ?? ""),
    queryFn: () => platformApi.getWorkspace(id!),
    enabled: !!id,
  });
}

export function useSuspendWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      platformApi.suspendWorkspace(id, reason),
    onSuccess: (workspace) => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
      qc.setQueryData(platformKeys.workspace(workspace.id), workspace);
    },
  });
}

export function useReactivateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformApi.reactivateWorkspace(id),
    onSuccess: (workspace) => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
      qc.setQueryData(platformKeys.workspace(workspace.id), workspace);
    },
  });
}

export function useRestoreWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformApi.restoreWorkspace(id),
    onSuccess: (workspace) => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
      qc.setQueryData(platformKeys.workspace(workspace.id), workspace);
    },
  });
}

export function usePlatformUsers(params: PlatformUsersListParams) {
  return useQuery({
    queryKey: platformKeys.users(params),
    queryFn: () => platformApi.listUsers(params),
  });
}

export function usePlatformUser(id: string | null) {
  return useQuery({
    queryKey: platformKeys.user(id ?? ""),
    queryFn: () => platformApi.getUser(id!),
    enabled: !!id,
  });
}

export function usePlatformUserLoginHistory(id: string | null) {
  return useQuery({
    queryKey: platformKeys.userLoginHistory(id ?? ""),
    queryFn: () => platformApi.getUserLoginHistory(id!),
    enabled: !!id,
  });
}

export function useUpdatePlatformRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      platformApi.updateUserPlatformRole(id, role),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: platformKeys.users({}) });
      qc.invalidateQueries({ queryKey: platformKeys.user(user.id) });
      qc.invalidateQueries({ queryKey: platformKeys.all });
    },
  });
}

export function usePlatformWebhookLogs(params: PlatformWebhookLogsParams) {
  return useQuery({
    queryKey: platformKeys.webhookLogs(params),
    queryFn: () => platformApi.listWebhookLogs(params),
  });
}

export function usePlatformUsageEvents(params: PlatformUsageEventsParams) {
  return useQuery({
    queryKey: platformKeys.usageEvents(params),
    queryFn: () => platformApi.listUsageEvents(params),
  });
}

export function usePlatformAuditLogs(params: PlatformAuditLogsParams) {
  return useQuery({
    queryKey: platformKeys.auditLogs(params),
    queryFn: () => platformApi.listAuditLogs(params),
  });
}

export function useChannelAccounts() {
  return useQuery({
    queryKey: platformKeys.channelAccounts(),
    queryFn: () => platformApi.listChannelAccounts(),
  });
}

export function useConnectedClientBusinesses() {
  return useQuery({
    queryKey: platformKeys.connectedClientBusinesses(),
    queryFn: () => platformApi.listConnectedClientBusinesses(),
  });
}

export function useAssignChannelAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      workspaceId,
    }: {
      id: string;
      workspaceId?: string | null;
    }) => platformApi.assignChannelAccount(id, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformKeys.channelAccounts() });
    },
  });
}

export function usePlatformAccessRequests(
  status?: AccountAccessRequestStatus
) {
  return useQuery({
    queryKey: platformKeys.accessRequests(status),
    queryFn: () => platformApi.listAccessRequests({ status }),
  });
}

export function usePlatformAccessRequestsOpenCount() {
  return useQuery({
    queryKey: platformKeys.accessRequestsOpenCount(),
    queryFn: () => platformApi.accessRequestsOpenCount(),
  });
}

export function useGenerateAccessResetLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformApi.generateAccessResetLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
    },
  });
}

export function useUpdateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status?: AccountAccessRequestStatus;
      notes?: string;
    }) => platformApi.updateAccessRequest(id, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
    },
  });
}

export function useGenerateUserResetLink() {
  return useMutation({
    mutationFn: (id: string) => platformApi.generateUserResetLink(id),
  });
}
