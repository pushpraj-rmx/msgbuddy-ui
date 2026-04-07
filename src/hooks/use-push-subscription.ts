"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";

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

async function doSubscribe(workspaceId: string): Promise<void> {
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

function getInitialPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

export function usePushSubscription(workspaceId: string) {
  const [permission, setPermission] =
    useState<NotificationPermission>(getInitialPermission);

  // Silently subscribe if already granted (e.g. returning visitor)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      permission !== "granted"
    ) {
      return;
    }
    doSubscribe(workspaceId).catch(console.error);
  }, [workspaceId, permission]);

  // Ask for permission then subscribe — call this from a user gesture
  const requestAndSubscribe = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await doSubscribe(workspaceId);
    }
  }, [workspaceId]);

  return { permission, requestAndSubscribe };
}
