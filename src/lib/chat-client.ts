import type { ChatMessage, StreamEvent } from "@/lib/types";

/**
 * `/api/chat` ga so'rov yuboradi va serverdan kelayotgan NDJSON oqimini
 * qator-qator o'qib, har bir matn bo'lagini `onText` ga uzatadi.
 */
export async function streamChat(options: {
  messages: ChatMessage[];
  initData: string;
  signal: AbortSignal;
  onText: (chunk: string) => void;
}): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages,
      initData: options.initData,
    }),
    signal: options.signal,
  });

  if (!response.body) {
    throw new Error("Serverdan javob kelmadi.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) handleLine(line, options.onText);
    }
  }

  const rest = buffer.trim();
  if (rest) handleLine(rest, options.onText);
}

function handleLine(line: string, onText: (chunk: string) => void): void {
  let event: StreamEvent;
  try {
    event = JSON.parse(line) as StreamEvent;
  } catch {
    return; // yarim qator - e'tiborsiz qoldiramiz
  }

  if (event.type === "text") {
    onText(event.text);
  } else if (event.type === "error") {
    throw new Error(event.message);
  }
}
