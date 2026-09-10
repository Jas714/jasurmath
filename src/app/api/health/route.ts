export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Xizmat holati. Model chaqirilmaydi, ya'ni bepul va tez. */
export function GET() {
  return Response.json(
    {
      status: "ok",
      app: "JasurMath",
      vaqt: new Date().toISOString(),
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
