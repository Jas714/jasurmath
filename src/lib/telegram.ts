import crypto from "node:crypto";

/**
 * Telegram Mini App `initData` ni server tomonda tekshirish.
 * Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Mantiq:
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   hash       = HMAC_SHA256(key = secret_key,  data = data_check_string)
 * bu yerda data_check_string - `hash` dan tashqari barcha maydonlar
 * "kalit=qiymat" ko'rinishida, alifbo tartibida, "\n" bilan ulangan.
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

  const pairs = parsePairs(initData);
  const hash = pairs.find(([key]) => key === "hash")?.[1];
  if (!hash) return { ok: false, reason: "hash yo'q" };

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  /**
   * Telegram keyinchalik `signature` maydonini qo'shdi (u uchinchi tomon
   * tekshiruvi uchun). Ba'zi mijozlar uni HMAC hisobiga qo'shadi, ba'zilari
   * yo'q. Shuning uchun ikkala variantni ham sinaymiz - qaysi biri mos kelsa
   * o'sha qabul qilinadi.
   */
  const withSignature = buildCheckString(pairs, ["hash"]);
  const withoutSignature = buildCheckString(pairs, ["hash", "signature"]);

  const matched = [withSignature, withoutSignature].some((checkString) =>
    timingSafeEqualHex(
      crypto.createHmac("sha256", secretKey).update(checkString).digest("hex"),
      hash,
    ),
  );

  if (!matched) return { ok: false, reason: "hash mos kelmadi" };

  const authDate = Number(pairs.find(([key]) => key === "auth_date")?.[1]);
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: "auth_date noto'g'ri" };
  }
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "initData eskirgan" };
  }

  const userRaw = pairs.find(([key]) => key === "user")?.[1];
  return { ok: true, user: parseUser(userRaw) };
}

/**
 * Query stringni qo'lda ajratamiz. `URLSearchParams` dan foydalanmaymiz,
 * chunki u "+" ni probelga aylantiradi - Telegram esa probelni "%20" bilan
 * kodlaydi, ya'ni haqiqiy "+" belgisi qiymat ichida bo'lishi mumkin.
 */
function parsePairs(initData: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const part of initData.split("&")) {
    if (!part) continue;
    const index = part.indexOf("=");
    const rawKey = index === -1 ? part : part.slice(0, index);
    const rawValue = index === -1 ? "" : part.slice(index + 1);
    try {
      pairs.push([decodeURIComponent(rawKey), decodeURIComponent(rawValue)]);
    } catch {
      pairs.push([rawKey, rawValue]); // noto'g'ri kodlangan - o'z holicha
    }
  }
  return pairs;
}

function buildCheckString(
  pairs: Array<[string, string]>,
  exclude: string[],
): string {
  return pairs
    .filter(([key]) => !exclude.includes(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function parseUser(raw: string | undefined): TelegramUser | null {
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
