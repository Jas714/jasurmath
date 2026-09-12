import type { Metadata } from "next";

import { ApiTester } from "@/components/ApiTester";

export const metadata: Metadata = {
  title: "JasurMath API",
  description: "Matematik masalalarni yechadigan ochiq API hujjati",
};

const BASE_URL = "https://jasur-math.vercel.app";

const CURL = `curl -X POST ${BASE_URL}/api/solve \\
  -H "Content-Type: application/json" \\
  -d '{"savol": "2x + 5 = 13"}'`;

const RESPONSE = `{
  "savol": "2x + 5 = 13",
  "mavzu": "chiziqli tenglama",
  "javob": "x = 4",
  "yechim": [
    "Ikkala tomondan 5 ni ayiramiz: 2x = 8",
    "Ikkala tomonni 2 ga bo'lamiz: x = 4",
    "Tekshiramiz: 2 * 4 + 5 = 13"
  ],
  "model": "gemini-3.6-flash"
}`;

const JS_EXAMPLE = `const res = await fetch("${BASE_URL}/api/solve", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ savol: "12 ning 25 foizi nechchi?" }),
});

const data = await res.json();
console.log(data.javob);`;

const KEY_EXAMPLE = `curl -X POST ${BASE_URL}/api/solve \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: SIZNING_KALITINGIZ" \\
  -d '{"savol": "Uchburchak yuzasi formulasi"}'`;

export default function ApiDocsPage() {
  return (
    <main className="docs">
      <h1>JasurMath API</h1>
      <p className="lead">
        Matematik masalani yuboring — tuzilgan JSON javob oling. Javobni Google{" "}
        <code>gemini-3.6-flash</code> modeli tayyorlaydi.
      </p>

      <h2>Sinab ko&apos;ring</h2>
      <ApiTester />

      <h2>Asosiy manzil</h2>
      <pre>
        <code>{BASE_URL}</code>
      </pre>

      <h2>Endpointlar</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metod</th>
              <th>Yo&apos;l</th>
              <th>Tavsif</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="method method-get">GET</span>
              </td>
              <td>
                <code>/api/health</code>
              </td>
              <td>Xizmat holati. Model chaqirilmaydi, cheklovsiz.</td>
            </tr>
            <tr>
              <td>
                <span className="method">POST</span>
              </td>
              <td>
                <code>/api/solve</code>
              </td>
              <td>Masalani yechadi va JSON qaytaradi.</td>
            </tr>
            <tr>
              <td>
                <span className="method method-get">GET</span>
              </td>
              <td>
                <code>/api/solve</code>
              </td>
              <td>Shu endpoint haqida qisqa ma&apos;lumot.</td>
            </tr>
            <tr>
              <td>
                <span className="method">POST</span>
              </td>
              <td>
                <code>/api/chat</code>
              </td>
              <td>
                Mini App ichki endpointi. Telegram HMAC imzosi talab qilinadi.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>POST /api/solve</h2>

      <h3>So&apos;rov</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Maydon</th>
              <th>Turi</th>
              <th>Tavsif</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>savol</code>
              </td>
              <td>string</td>
              <td>Matematik masala. Eng ko&apos;pi 500 belgi. Majburiy.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <pre>
        <code>{CURL}</code>
      </pre>

      <h3>Javob</h3>
      <pre>
        <code>{RESPONSE}</code>
      </pre>

      <h3>JavaScript misoli</h3>
      <pre>
        <code>{JS_EXAMPLE}</code>
      </pre>

      <h2>Cheklovlar</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Turi</th>
              <th>Limit</th>
              <th>Hisoblanadi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Kalitsiz</td>
              <td>soatiga 3 ta so&apos;rov</td>
              <td>IP manzil bo&apos;yicha</td>
            </tr>
            <tr>
              <td>
                Kalit bilan (<code>X-API-Key</code>)
              </td>
              <td>soatiga 100 ta so&apos;rov</td>
              <td>Kalit bo&apos;yicha</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Har javobda <code>X-RateLimit-Limit</code> va{" "}
        <code>X-RateLimit-Remaining</code> sarlavhalari qaytariladi.
      </p>

      <pre>
        <code>{KEY_EXAMPLE}</code>
      </pre>

      <h2>Xato kodlari</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ma&apos;nosi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>400</code>
              </td>
              <td>
                <code>savol</code> bo&apos;sh yoki matematikaga oid emas
              </td>
            </tr>
            <tr>
              <td>
                <code>401</code>
              </td>
              <td>Berilgan API kalit noto&apos;g&apos;ri</td>
            </tr>
            <tr>
              <td>
                <code>429</code>
              </td>
              <td>Soatlik cheklovga yetildi</td>
            </tr>
            <tr>
              <td>
                <code>502</code> / <code>503</code> / <code>504</code>
              </td>
              <td>Model tomonidagi vaqtinchalik nosozlik</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>Xato javobi har doim shu ko&apos;rinishda:</p>
      <pre>
        <code>{`{ "xato": "Soatlik cheklovga yetdingiz (3 ta so'rov)." }`}</code>
      </pre>

      <h2>Loyiha haqida</h2>
      <p>
        JasurMath — matematikani noldan o&apos;rgatadigan Telegram Mini App.
        Ilova <a href="/">shu yerda</a>, bot esa{" "}
        <a href="https://t.me/Jasur_Math_bot">@Jasur_Math_bot</a>.
      </p>
      <p>
        Texnologiyalar: Next.js 15 (App Router), TypeScript, Google Gemini API
        (structured outputs), Vercel.
      </p>
    </main>
  );
}
