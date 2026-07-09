"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";

/**
 * Browser push notifications are OFF by default. The user opts in from
 * Settings → Notifications (or the top-bar hint), which flips this per-browser
 * flag and subscribes. We only ever re-subscribe on load when the user has
 * explicitly enabled push before — granting the browser permission alone is
 * not enough.
 */
const PUSH_ENABLED_KEY = "push-notifications-enabled";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function doSubscribe(): Promise<void> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const p256dh = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!p256dh || !auth) return;

  await api.post("/v2/push/subscriptions", {
    endpoint: sub.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(p256dh),
      auth: arrayBufferToBase64(auth),
    },
  });
}

async function doUnsubscribe(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  // Best-effort: drop the server record, then tear down the browser subscription.
  await api
    .delete("/v2/push/subscriptions", { data: { endpoint: sub.endpoint } })
    .catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

function getInitialPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

function getInitialEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Result of an enable() attempt: granted, or why it didn't turn on. */
export type EnablePushResult =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export function usePushSubscription(workspaceId: string) {
  // Always start with SSR-safe defaults so the server and first client render
  // match; the effect below reconciles to the real values after hydration.
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: Notification.permission / localStorage unavailable during SSR
    setPermission(getInitialPermission());
    setEnabled(getInitialEnabled());
  }, []);

  // Silently re-subscribe on load ONLY when the user has explicitly opted in
  // before and the browser permission is still granted.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !enabled ||
      permission !== "granted"
    ) {
      return;
    }
    doSubscribe().catch(console.error);
  }, [workspaceId, permission, enabled]);

  // Turn push on — request permission (if needed) then subscribe. Call from a
  // user gesture (e.g. the settings toggle).
  const enable = useCallback(async (): Promise<EnablePushResult> => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return "unsupported";
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return result;

    await doSubscribe();
    try {
      localStorage.setItem(PUSH_ENABLED_KEY, "true");
    } catch {
      // ignore
    }
    setEnabled(true);
    return "granted";
  }, []);

  // Turn push off — unsubscribe this browser and clear the opt-in flag.
  const disable = useCallback(async (): Promise<void> => {
    await doUnsubscribe();
    try {
      localStorage.setItem(PUSH_ENABLED_KEY, "false");
    } catch {
      // ignore
    }
    setEnabled(false);
  }, []);

  return { permission, enabled, enable, disable };
}
