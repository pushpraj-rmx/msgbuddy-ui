"use client";

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";

/**
 * PWA install prompt:
 * - Android/Chrome/Edge: native `beforeinstallprompt` flow
 * - iOS Safari: instructions to use Share → Add to Home Screen
 * - Hidden when already installed (`display-mode: standalone`)
 * - Dismissed state persists in localStorage for 7 days
 */

const DISMISSED_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    const ageMs = Date.now() - dismissedAt;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // The desktop (Electron) app is already a "native install" — never prompt.
    if (window.msgbuddyDesktop?.isDesktop) return;
    if (isStandalone()) return;
    if (isDismissedRecently()) return;

    // Android / Chromium: capture install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS: show hint after a short delay (no native prompt)
    if (isIos()) {
      const timer = window.setTimeout(() => {
        setShowIosHint(true);
        setVisible(true);
      }, 2000);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.clearTimeout(timer);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md sm:bottom-6"
      role="dialog"
      aria-label="Install MsgBuddy"
    >
      <div className="rounded-box border border-base-300 bg-base-200 shadow-lg">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100">
              <BrandIcon expression="happy" className="h-6 w-6" title="MsgBuddy" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Install MsgBuddy</h3>
              <p className="mt-0.5 text-xs text-base-content/60">
                {showIosHint
                  ? "Tap the Share button, then Add to Home Screen for the full app experience."
                  : "Add to your home screen for quick access and notifications."}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square shrink-0 -mr-2 -mt-2"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={dismiss}
            >
              Not now
            </button>
            {showIosHint ? (
              <div className="flex items-center gap-1 text-xs text-base-content/60">
                <Share className="h-3.5 w-3.5" />
                <span>Tap Share below</span>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={install}
                disabled={!installEvent}
              >
                Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
