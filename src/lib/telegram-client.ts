/**
 * Telegram WebApp obyekti bilan ishlash uchun yupqa qatlam.
 * SDK `telegram-web-app.js` skripti orqali `window.Telegram` ga tushadi.
 */

export interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/** Mini App ochilganda bir marta chaqiriladi. */
export function initWebApp(): TelegramWebApp | null {
  const webApp = getWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  // Chatda yuqoriga surganda oyna yopilib ketmasin.
  webApp.disableVerticalSwipes?.();
  webApp.setHeaderColor?.("secondary_bg_color");

  return webApp;
}

export function hapticTap(): void {
  getWebApp()?.HapticFeedback?.impactOccurred("light");
}
