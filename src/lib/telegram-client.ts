// Browser-side helpers for the Telegram Mini App runtime.
type WebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: { id: number } };
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  isVersionAtLeast?: (v: string) => boolean;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred: (s: "light" | "medium" | "heavy") => void; notificationOccurred: (s: "success" | "error" | "warning") => void };
  platform?: string;
};

export function tgApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp ?? null) as WebApp | null;
}

export function initData(): string {
  return tgApp()?.initData ?? "";
}

export function initTelegram() {
  const app = tgApp();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    if (app.isVersionAtLeast?.("8.0") && app.platform !== "tdesktop" && app.platform !== "macos" && app.platform !== "web" && app.platform !== "weba") {
      app.requestFullscreen?.();
    }
    if (app.isVersionAtLeast?.("7.7")) app.disableVerticalSwipes?.();
    if (app.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.("#ececeb");
      app.setBackgroundColor?.("#ececeb");
    }
    if (app.isVersionAtLeast?.("7.10")) app.setBottomBarColor?.("#ececeb");
  } catch {
    /* older clients */
  }
}

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  const h = tgApp()?.HapticFeedback;
  if (!h) return;
  if (kind === "success" || kind === "error") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}

export function openTgLink(url: string) {
  const app = tgApp();
  if (url.startsWith("https://t.me/") && app?.openTelegramLink) app.openTelegramLink(url);
  else if (app?.openLink) app.openLink(url);
  else window.open(url, "_blank");
}
