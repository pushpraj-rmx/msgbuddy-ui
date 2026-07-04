export {};

/**
 * Bridge injected by the msgbuddy-desktop Electron shell (see
 * ../../msgbuddy-desktop/src/preload/index.ts). Present only when the web app
 * runs inside the desktop app; `undefined` in a normal browser.
 */
declare global {
  interface Window {
    msgbuddyDesktop?: {
      readonly isDesktop: true;
      readonly platform: string;
      getVersion: () => Promise<string>;
      setBadgeCount: (count: number) => void;
      onDeepLink: (callback: (url: string) => void) => () => void;
      loginViaBrowser: () => Promise<void>;
    };
  }
}
