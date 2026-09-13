export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Xizmat holati. Model chaqirilmaydi, ya'ni bepul va tez. */
export function GET() {
  return Response.json(
    {
      status: "ok",
      app: "JasurMath",
      vaqt: new Date().toISOString(),
      // Qaysi commit deploy qilinganini bilish uchun - nosozlik qidirganda
      // "internetdagi kod qaysi versiya" degan savolga darrov javob beradi.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "lokal",
      model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
      endpointlar: ["/api/health", "/api/solve", "/api/chat"],
      hujjat: "/api",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
