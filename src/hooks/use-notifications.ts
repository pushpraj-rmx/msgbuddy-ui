"use client";

import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import type { NotificationItem, NotificationsListResponse } from "@/lib/types";
import { isNotificationCreated, parseWorkspaceSseEvent } from "@/lib/sseEvents";

export const notificationQueryKeys = {
  all: ["notifications"] as const,
  list: (params: { page: number; limit: number; unreadOnly: boolean }) =>
    [...notificationQueryKeys.all, "list", params] as const,
  unreadCount: () => [...notificationQueryKeys.all, "unread-count"] as const,
};

function normalizeNotification(value: unknown): NotificationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.workspaceId !== "string" ||
    typeof o.type !== "string" ||
    typeof o.severity !== "string" ||
    typeof o.title !== "string" ||
    typeof o.body !== "string" ||
    typeof o.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: o.id,
    workspaceId: o.workspaceId,
    userId: typeof o.userId === "string" ? o.userId : null,
    type: o.type as NotificationItem["type"],
    severity: o.severity as NotificationItem["severity"],
    title: o.title,
    body: o.body,
    data:
      o.data && typeof o.data === "object" && !Array.isArray(o.data)
        ? (o.data as Record<string, unknown>)
        : null,
    idempotencyKey: typeof o.idempotencyKey === "string" ? o.idempotencyKey : "",
    readAt: typeof o.readAt === "string" ? o.readAt : null,
    createdAt: o.createdAt,
  };
}

export function useNotifications(options?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const unreadOnly = options?.unreadOnly ?? false;
  const listKey = notificationQueryKeys.list({ page, limit, unreadOnly });

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => notificationsApi.list({ page, limit, unreadOnly }),
    refetchInterval: 30_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 15_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });

  return {
    listQuery,
    unreadCountQuery,
    markRead,
    markAllRead,
  };
}

export type SseConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export function useNotificationSSE(workspaceId: string | null | undefined): {
  connectionState: SseConnectionState;
} {
  const queryClient = useQueryClient();
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const [connectionState, setConnectionState] = useState<SseConnectionState>("connecting");
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);

  useEffect(() => {
    if (!workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync connection state when workspaceId becomes null
      setConnectionState("offline");
      return;
    }

    let cancelled = false;
    seenNotificationIdsRef.current = new Set();
    retryDelayRef.current = 1000;

    function connect() {
      if (cancelled) return;
      setConnectionState("connecting");

      const es = new EventSource(`/api/sse/workspace/${workspaceId}`);

      es.onopen = () => {
        if (cancelled) { es.close(); return; }
        setConnectionState("live");
        retryDelayRef.current = 1000; // reset backoff on successful connect
      };

      es.onmessage = (event) => {
        const parsed = parseWorkspaceSseEvent(event.data);
        if (!parsed || !isNotificationCreated(parsed.type)) return;

        const payload = parsed.data;
        const notification = normalizeNotification(
          (payload as Record<string, unknown>).notification
        );
        if (!notification) return;

        if (seenNotificationIdsRef.current.has(notification.id)) return;
        seenNotificationIdsRef.current.add(notification.id);

        queryClient.setQueryData<{ count: number }>(
          notificationQueryKeys.unreadCount(),
          (current) => ({ count: (current?.count ?? 0) + 1 })
        );

        queryClient.setQueriesData<NotificationsListResponse>(
          { queryKey: [...notificationQueryKeys.all, "list"] as QueryKey },
          (current) => {
            if (!current) return current;
            const existingIdx = current.items.findIndex((it) => it.id === notification.id);
            if (existingIdx >= 0) return current;
            return {
              ...current,
              total: current.total + 1,
              items: [notification, ...current.items].slice(0, current.limit),
            };
          }
        );
      };

      es.onerror = () => {
        es.close();
        if (cancelled) return;
        setConnectionState("reconnecting");
        const delay = Math.min(retryDelayRef.current, 30_000);
        retryDelayRef.current = delay * 1.5; // exponential backoff
        retryRef.current = setTimeout(connect, delay);
      };

      // Cleanup for this specific EventSource
      return () => {
        es.close();
      };
    }

    const closeEs = connect();

    return () => {
      cancelled = true;
      closeEs?.();
      if (retryRef.current) clearTimeout(retryRef.current);
      setConnectionState("offline");
    };
  }, [workspaceId, queryClient]);

  return { connectionState };
}
