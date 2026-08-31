import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

import { SYSTEM_PROMPT } from "@/lib/prompt";
import { takeToken } from "@/lib/rate-limit";
import { verifyInitData } from "@/lib/telegram";
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  type ChatMessage,
  type StreamEvent,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Model va "effort" ni .env.local orqali almashtirish mumkin.
 * Sinov paytida arzonroq model bilan ishlab, keyin productionda
 * claude-opus-5 ga qaytish uchun qulay.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT ?? "medium") as
  | "low"
  | "medium"
  | "high";

/**
 * Adaptive thinking, "effort" va zaxira model (fallback) faqat yangi
 * modellarda ishlaydi. Eski modelda (masalan claude-haiku-4-5) bu
 * parametrlar 400 xato qaytaradi - shuning uchun ular tashlab yuboriladi.
 */
const ADVANCED_MODELS = new Set([
  "claude-fable-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
]);

// System prompt o'zgarmaydi -> keshlanadi (arzonroq va tezroq).
const SYSTEM_BLOCKS = [
  {
    type: "text" as const,
    text: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" as const },
  },
];

const client = new Anthropic();
const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "So'rov formati noto'g'ri.");
  }

  const parsed = parseBody(body);
  if (!parsed.ok) return errorResponse(400, parsed.message);

  const auth = authenticate(parsed.initData);
  if (!auth.ok) return errorResponse(401, auth.message);

  if (!takeToken(auth.userKey)) {
    return errorResponse(
      429,
      "Biroz sekinroq :) Bir daqiqadan keyin yana urinib ko'r.",
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(
      500,
      "Server sozlanmagan: ANTHROPIC_API_KEY topilmadi.",
    );
  }

  const baseParams = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_BLOCKS,
    messages: parsed.messages,
  };

  const stream = ADVANCED_MODELS.has(MODEL)
    ? client.beta.messages.stream({
        ...baseParams,
        // Model masalani yechishdan oldin o'ylab oladi - matematikada muhim.
        thinking: { type: "adaptive" },
        // Sifat yetarli bo'lmasa ANTHROPIC_EFFORT=high qiling.
        output_config: { effort: EFFORT },
        // Model so'rovni rad etsa, shu chaqiruv ichida zaxira modelda
        // qayta ishlanadi. Kerak bo'lmasa shu ikki qatorni o'chiring.
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: "claude-opus-4-8" }],
      })
    : client.beta.messages.stream(baseParams);

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message:
              "Bu savolga javob bera olmadim. Iltimos, matematikaga oid savol ber.",
          });
        }
        send({ type: "done" });
      } catch (error) {
        send({ type: "error", message: describeError(error) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(responseBody, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

type ParsedBody =
  | { ok: true; messages: ChatMessage[]; initData: string }
  | { ok: false; message: string };

function parseBody(body: unknown): ParsedBody {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "So'rov tanasi bo'sh." };
  }

  const { messages, initData } = body as {
    messages?: unknown;
    initData?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: "Xabarlar ro'yxati bo'sh." };
  }

  const cleaned: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) continue;
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    cleaned.push({ role, content: trimmed.slice(0, MAX_MESSAGE_CHARS) });
  }

  // Faqat oxirgi N ta xabar yuboriladi - tarix cheksiz o'sib ketmasin.
  const trimmedHistory = cleaned.slice(-MAX_HISTORY_MESSAGES);

  // Claude uchun birinchi xabar "user" bo'lishi shart.
  while (trimmedHistory.length > 0 && trimmedHistory[0].role !== "user") {
    trimmedHistory.shift();
  }

  if (trimmedHistory.length === 0 || trimmedHistory.at(-1)?.role !== "user") {
    return { ok: false, message: "Oxirgi xabar foydalanuvchidan bo'lishi kerak." };
  }

  return {
    ok: true,
    messages: trimmedHistory,
    initData: typeof initData === "string" ? initData : "",
  };
}

type AuthResult =
  | { ok: true; userKey: string }
  | { ok: false; message: string };

function authenticate(initData: string): AuthResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const isDev = process.env.NODE_ENV !== "production";

  if (!botToken) {
    if (isDev) return { ok: true, userKey: "dev" };
    return {
      ok: false,
      message: "Server sozlanmagan: TELEGRAM_BOT_TOKEN topilmadi.",
    };
  }

  // Dev rejimida oddiy brauzerdan (Telegramsiz) sinash uchun yo'l ochiq.
  // Productionda bu shart hech qachon bajarilmaydi - tekshiruv doim ishlaydi.
  if (isDev && !initData) return { ok: true, userKey: "dev" };

  const result = verifyInitData(initData, botToken);
  if (!result.ok) {
    return { ok: false, message: "Telegram tekshiruvi o'tmadi." };
  }

  return { ok: true, userKey: result.user ? `tg:${result.user.id}` : "tg:anon" };
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.NotFoundError) {
    return "Model topilmadi. Server sozlamalarini tekshiring.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Hozir yuklama katta. Bir necha soniyadan keyin qayta urinib ko'r.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "API kaliti noto'g'ri yoki eskirgan.";
  }
  // APIConnectionError ham APIError dan meros oladi - shuning uchun oldinroq.
  if (error instanceof Anthropic.APIConnectionError) {
    return "Internet bilan aloqa uzildi. Qayta urinib ko'r.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Xizmat xatosi (${error.status ?? "?"}). Keyinroq urinib ko'r.`;
  }
  console.error("Kutilmagan xato:", error);
  return "Kutilmagan xato yuz berdi. Qayta urinib ko'r.";
}

function errorResponse(status: number, message: string): Response {
  const event: StreamEvent = { type: "error", message };
  return new Response(`${JSON.stringify(event)}\n`, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
