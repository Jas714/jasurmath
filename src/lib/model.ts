import { GoogleGenAI, Type } from "@google/genai";

import type { ChatMessage } from "@/lib/types";

/**
 * Modelga so'rov yuboradigan yagona qatlam.
 *
 * Hozir Google Gemini ishlatiladi (bepul tarif). Provayder almashsa,
 * faqat shu fayl o'zgaradi - route'lar tegilmaydi.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let cached: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ModelError("Server sozlanmagan: GEMINI_API_KEY yo'q.");
  cached ??= new GoogleGenAI({ apiKey });
  return cached;
}

/** Route'lar foydalanuvchiga ko'rsatadigan, tayyor matnli xato. */
export class ModelError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/** Bizning rollarni Gemini kutadigan ko'rinishga o'tkazadi. */
function toContents(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

/** Chat: javobni bo'lak-bo'lak qaytaradi. */
export async function* streamChat(options: {
  system: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const stream = await client().models.generateContentStream({
    model: MODEL,
    contents: toContents(options.messages),
    config: {
      systemInstruction: options.system,
      maxOutputTokens: 8192,
      abortSignal: options.signal,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

export interface SolveResult {
  matematikami: boolean;
  mavzu: string;
  javob: string;
  yechim: string[];
}

/** Ochiq API: masalani yechib, tuzilgan JSON qaytaradi. */
export async function solve(options: {
  system: string;
  savol: string;
}): Promise<SolveResult> {
  const response = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: options.savol }] }],
    config: {
      systemInstruction: options.system,
      maxOutputTokens: 4096,
      // Sxema modelga majburlanadi - javob doim shu shaklda keladi.
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matematikami: {
            type: Type.BOOLEAN,
            description: "Savol matematikaga oid bo'lsa true",
          },
          mavzu: {
            type: Type.STRING,
            description: "Masala mavzusi, masalan: chiziqli tenglama",
          },
          javob: {
            type: Type.STRING,
            description: "Yakuniy javob, qisqa. Masalan: x = 4",
          },
          yechim: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Yechim bosqichlari, har biri bitta qator",
          },
        },
        required: ["matematikami", "mavzu", "javob", "yechim"],
      },
    },
  });

  const raw = response.text;
  if (!raw) throw new ModelError("Modeldan bo'sh javob keldi.", 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ModelError("Javobni tahlil qilib bo'lmadi.", 502);
  }

  const result = parsed as Partial<SolveResult>;
  if (
    typeof result.matematikami !== "boolean" ||
    typeof result.javob !== "string" ||
    !Array.isArray(result.yechim)
  ) {
    throw new ModelError("Model javobi kutilgan shaklda emas.", 502);
  }

  return {
    matematikami: result.matematikami,
    mavzu: typeof result.mavzu === "string" ? result.mavzu : "",
    javob: result.javob,
    yechim: result.yechim.filter((step): step is string => typeof step === "string"),
  };
}

/** Modelning ishlatilgan nomi - javoblarda ko'rsatish uchun. */
export function modelName(): string {
  return MODEL;
}

/** Xatoni foydalanuvchiga ko'rsatiladigan matnga aylantiradi. */
export function describeModelError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof ModelError) {
    return { status: error.status, message: error.message };
  }

  // @google/genai ApiError ni `status` maydoni bilan tashlaydi.
  const status = (error as { status?: unknown })?.status;
  const detail = error instanceof Error ? error.message : String(error);

  if (typeof status === "number") {
    console.error(`Gemini xatosi ${status}: ${detail}`);

    if (status === 429) {
      return {
        status: 429,
        message: "Bepul limit tugadi. Bir necha daqiqadan keyin urinib ko'ring.",
      };
    }
    if (status === 401 || status === 403) {
      return { status: 500, message: "Server kaliti noto'g'ri yoki eskirgan." };
    }
    if (status >= 500) {
      return { status: 502, message: "Model vaqtincha ishlamayapti." };
    }
    return { status: 502, message: `Model xatosi (${status}).` };
  }

  console.error("Kutilmagan model xatosi:", error);
  return { status: 500, message: "Kutilmagan xato yuz berdi." };
}
