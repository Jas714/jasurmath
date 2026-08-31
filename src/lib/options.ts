/**
 * Model javob oxiriga `[[VARIANTLAR: A | B | C]]` qatorini qo'shadi.
 * Bu yerda o'sha qator matndan ajratib olinadi va tugmalarga aylantiriladi.
 */

const OPTIONS_RE = /\[\[\s*VARIANTLAR\s*:\s*([^\]]*?)\]\]/i;
/** Oqim (streaming) paytida yarim yozilgan "[[VARI..." ni ko'rsatmaslik uchun. */
const PARTIAL_RE = /\[\[[^\]]*$/;

const MAX_OPTIONS = 4;

export interface ParsedReply {
  /** Ekranda ko'rsatiladigan matn. */
  body: string;
  /** Tugmalar uchun variantlar (bo'sh bo'lishi mumkin). */
  options: string[];
}

export function parseReply(text: string): ParsedReply {
  const match = text.match(OPTIONS_RE);

  if (!match) {
    return { body: text.replace(PARTIAL_RE, "").trimEnd(), options: [] };
  }

  const options = match[1]
    .split("|")
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);

  return { body: text.replace(OPTIONS_RE, "").trimEnd(), options };
}
