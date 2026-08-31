/** Klient va server o'rtasidagi umumiy tiplar. */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Serverdan klientga NDJSON qatorlari ko'rinishida keladigan hodisalar. */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Bitta so'rovda yuboriladigan yakuniy tarix uzunligi. */
export const MAX_HISTORY_MESSAGES = 40;

/** Bitta xabarning maksimal uzunligi (belgi). */
export const MAX_MESSAGE_CHARS = 4000;

/**
 * Suhbat bo'sh bo'lganda modelga yuboriladigan birinchi turtki.
 * Ekranda ko'rinmaydi - shunchaki JasurMath birinchi bo'lib gap boshlashi uchun.
 */
export const KICKOFF_MESSAGE = "Salom! Men matematikani o'rganmoqchiman.";
