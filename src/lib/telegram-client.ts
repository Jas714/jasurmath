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

/**
 * Telegram SDK skripti sahifa kodidan keyinroq yuklanishi mumkin.
 * Shuning uchun `window.Telegram` paydo bo'lguncha kutamiz - aks holda
 * initData bo'sh ketadi va server so'rovni rad etadi.
 */
export async function waitForWebApp(
  timeoutMs = 3000,
): Promise<TelegramWebApp | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const webApp = getWebApp();
    if (webApp) return webApp;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Har so'rovda yangi initData olinadi (u vaqt o'tishi bilan yangilanadi). */
export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

/** Mini App ochilganda bir marta chaqiriladi. */
export async function initWebApp(): Promise<TelegramWebApp | null> {
  const webApp = await waitForWebApp();
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
