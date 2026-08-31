import crypto from "node:crypto";

/**
 * Telegram Mini App `initData` ni server tomonda tekshirish.
 * Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Mantiq:
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   hash       = HMAC_SHA256(key = secret_key,  data = data_check_string)
 * bu yerda data_check_string - `hash` va `signature` dan tashqari barcha
 * maydonlar "kalit=qiymat" ko'rinishida, alifbo tartibida, "\n" bilan ulangan.
 */

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/** initData qancha vaqt amal qiladi (sekund). */
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export type VerifyResult =
  | { ok: true; user: TelegramUser | null }
  | { ok: false; reason: string };

export function verifyInitData(
  initData: string,
  botToken: string,
): VerifyResult {
  if (!initData) return { ok: false, reason: "initData bo'sh" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "hash yo'q" };

  // `hash` ning o'zi va Ed25519 `signature` data_check_string ga kirmaydi.
  params.delete("hash");
  params.delete("signature");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqualHex(expected, hash)) {
    return { ok: false, reason: "hash mos kelmadi" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: "auth_date noto'g'ri" };
  }
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "initData eskirgan" };
  }

  return { ok: true, user: parseUser(params.get("user")) };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function parseUser(raw: string | null): TelegramUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { id?: unknown }).id === "number"
    ) {
      return parsed as TelegramUser;
    }
  } catch {
    // noto'g'ri JSON - foydalanuvchisiz davom etamiz
  }
  return null;
}
