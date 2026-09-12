import { NextRequest } from "next/server";

import { describeModelError, streamChat } from "@/lib/model";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { createLimiter } from "@/lib/rate-limit";
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
 * Qaysi versiya productionda turganini bilish uchun belgi.
 * Tekshirish: curl https://jasur-math.vercel.app/api/chat
 */
const BUILD_MARKER = "2026-09-12-gemini";

const encoder = new TextEncoder();

/** Bitta o'quvchi uchun daqiqasiga 12 ta so'rov. */
const limiter = createLimiter({ capacity: 12, windowSeconds: 60 });

export function GET() {
  return Response.json({ app: "JasurMath", version: BUILD_MARKER });
}

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

  if (!limiter.take(auth.userKey)) {
    return errorResponse(
      429,
      "Biroz sekinroq :) Bir daqiqadan keyin yana urinib ko'r.",
    );
  }

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        let gotText = false;
        for await (const chunk of streamChat({
          system: SYSTEM_PROMPT,
          messages: parsed.messages,
        })) {
          gotText = true;
          send({ type: "text", text: chunk });
        }

        if (!gotText) {
          send({
            type: "error",
            message: "Model javob bermadi. Qayta urinib ko'r.",
          });
        }
        send({ type: "done" });
      } catch (error) {
        send({ type: "error", message: describeModelError(error).message });
      } finally {
        controller.close();
      }
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

  // Birinchi xabar "user" bo'lishi kerak.
  while (trimmedHistory.length > 0 && trimmedHistory[0].role !== "user") {
    trimmedHistory.shift();
  }

  if (trimmedHistory.length === 0 || trimmedHistory.at(-1)?.role !== "user") {
    return {
      ok: false,
      message: "Oxirgi xabar foydalanuvchidan bo'lishi kerak.",
    };
  }

  return {
    ok: true,
    messages: trimmedHistory,
    initData: typeof initData === "string" ? initData : "",
  };
}

type AuthResult = { ok: true; userKey: string } | { ok: false; message: string };

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
    // Texnik tafsilot serverga yoziladi, foydalanuvchi sodda xabar ko'radi.
    console.warn(
      `initData tekshiruvi o'tmadi: ${result.reason}; maydonlar: ${fieldNames(initData)}`,
    );
    return {
      ok: false,
      message:
        "Telegram tekshiruvi o'tmadi. Ilovani yopib, botdan qayta oching.",
    };
  }

  return { ok: true, userKey: result.user ? `tg:${result.user.id}` : "tg:anon" };
}

/** Faqat kalit nomlari - qiymatlar (hash, user) logga tushmaydi. */
function fieldNames(initData: string): string {
  return (
    initData
      .split("&")
      .map((part) => part.split("=")[0])
      .filter(Boolean)
      .sort()
      .join(", ") || "yo'q"
  );
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
