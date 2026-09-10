# JasurMath

Matematikani noldan o'rgatadigan AI-o'qituvchi. Telegram Mini App ko'rinishida
ishlaydi, Claude (`claude-opus-5`) modeliga tayanadi.

## Texnologiyalar

- **Next.js 15** (App Router) + **TypeScript** — frontend va backend bitta loyihada
- **@anthropic-ai/sdk** — Claude bilan oqim (streaming) rejimida ishlaydi
- API kaliti faqat serverda (`/api/chat` route handler) — brauzerga hech qachon chiqmaydi

## Ishga tushirish

```bash
npm install
cp .env.example .env.local     # keyin .env.local ni to'ldiring
npm run dev
```

`.env.local`:

| O'zgaruvchi | Kerakmi | Izoh |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Ha | https://console.anthropic.com dan olinadi (API pullik, minimal to'lov $5) |
| `TELEGRAM_BOT_TOKEN` | Productionda ha | @BotFather beradi. Dev rejimida bo'sh qolsa, brauzerdan Telegramsiz sinash mumkin |
| `ANTHROPIC_MODEL` | Yo'q | Default `claude-opus-5`. Arzonroq sinov uchun `claude-sonnet-5` yoki `claude-haiku-4-5` |
| `ANTHROPIC_EFFORT` | Yo'q | `low` / `medium` / `high`, default `medium` |
| `PUBLIC_API_KEY` | Yo'q | Ochiq API kaliti. Bo'sh bo'lsa faqat kalitsiz rejim (soatiga 3 so'rov) |
| `PUBLIC_API_MODEL` | Yo'q | Ochiq API uchun alohida model. Bo'sh bo'lsa `ANTHROPIC_MODEL` |

Brauzerda `http://localhost:3000` ni oching. Telegramsiz ham chat ishlaydi
(dev rejimida tekshiruv o'chirilgan).

## Telegramga ulash

1. [@BotFather](https://t.me/BotFather) da bot yarating, tokenni `.env.local` ga yozing.
2. Loyihani deploy qiling (Vercel: `vercel` — `ANTHROPIC_API_KEY` va
   `TELEGRAM_BOT_TOKEN` ni Environment Variables ga qo'shing).
3. BotFather da: `/newapp` → botni tanlang → Mini App URL sifatida deploy
   qilingan manzilni bering (masalan `https://jasurmath.vercel.app`).
4. Lokalda Telegram ichida sinash uchun tunnel kerak: `npx localtunnel --port 3000`
   yoki `ngrok http 3000`, keyin o'sha HTTPS manzilni BotFather ga bering.

## Ochiq API

Sayt Telegramdan tashqarida ham ishlatiladigan ochiq API beradi. To'liq hujjat
va jonli sinov formasi: **https://jasur-math.vercel.app/api**

| Metod | Yo'l | Tavsif |
| --- | --- | --- |
| GET | `/api/health` | Xizmat holati, cheklovsiz |
| POST | `/api/solve` | Masalani yechadi, JSON qaytaradi |
| GET | `/api/solve` | Endpoint haqida qisqa ma'lumot |
| POST | `/api/chat` | Mini App ichki endpointi (Telegram imzosi kerak) |

```bash
curl -X POST https://jasur-math.vercel.app/api/solve \
  -H "Content-Type: application/json" \
  -d '{"savol": "2x + 5 = 13"}'
```

```json
{
  "savol": "2x + 5 = 13",
  "mavzu": "chiziqli tenglama",
  "javob": "x = 4",
  "yechim": ["Ikkala tomondan 5 ni ayiramiz: 2x = 8", "..."],
  "model": "claude-opus-5"
}
```

Javob tuzilishi Claude'ning **structured outputs** imkoniyati bilan
kafolatlanadi (`zodOutputFormat`) - matn tahlil qilinmaydi, sxema modelga
majburlanadi.

**Cheklovlar:** kalitsiz - IP bo'yicha soatiga 3 so'rov; `X-API-Key`
sarlavhasi bilan - soatiga 100. Har javobda `X-RateLimit-Remaining` qaytadi.

## Fayl tuzilmasi

```
src/
├── app/
│   ├── api/page.tsx         Ochiq API hujjati (/api)
│   ├── api/chat/route.ts    Mini App endpointi, oqim (NDJSON) qaytaradi
│   ├── api/solve/route.ts   Ochiq API: masala -> tuzilgan JSON
│   ├── api/health/route.ts  Xizmat holati
│   ├── layout.tsx           Telegram WebApp SDK skripti shu yerda ulanadi
│   ├── page.tsx
│   └── globals.css          Telegram mavzu ranglariga moslashgan uslublar
├── components/
│   ├── Chat.tsx             Butun chat mantiqi (holat, oqim, tugmalar)
│   ├── MessageBubble.tsx    Markdown render
│   └── ApiTester.tsx        /api sahifasidagi jonli sinov formasi
└── lib/
    ├── prompt.ts            System prompt (o'qituvchi + Mini App qoidalari)
    ├── telegram.ts          initData ni HMAC bilan tekshirish (server)
    ├── telegram-client.ts   window.Telegram.WebApp bilan ishlash (klient)
    ├── chat-client.ts       Oqimni o'qish (fetch + ReadableStream)
    ├── options.ts           [[VARIANTLAR: ...]] ni tugmalarga ajratish
    ├── rate-limit.ts        Token-bucket cheklov (createLimiter)
    └── types.ts             Umumiy tiplar va limitlar
```

## Qanday ishlaydi

**Tugmalar.** System prompt modelga har javob oxirida shunday qator qo'shishni
buyuradi:

```
[[VARIANTLAR: Noldan o'rganish | Imtihonga tayyorgarlik | SAT]]
```

`src/lib/options.ts` bu qatorni matndan ajratib oladi va tugmalarga aylantiradi.
Foydalanuvchi bu qatorni matn sifatida ko'rmaydi. Oqim paytida yarim yozilgan
`[[VARI...` ham yashiriladi.

**Birinchi xabar.** Ilova ochilganda modelga ko'rinmas turtki
(`KICKOFF_MESSAGE`) yuboriladi — shuning uchun JasurMath birinchi bo'lib
salomlashadi va darrov maqsad haqida so'raydi.

**Suhbat xotirasi.** Tarix brauzerning `localStorage` ida saqlanadi
(`jasurmath.chat.v1`) va har so'rovda serverga yuboriladi. Server bazasi yo'q —
shuning uchun deploy qilish oson, lekin suhbat qurilmaga bog'liq. Foydalanuvchi
turli qurilmalarda bir xil tarixni ko'rishi kerak bo'lsa, Telegram user id bo'yicha
baza (Postgres/Redis) qo'shish kerak. Serverga oxirgi 40 ta xabar yuboriladi.

**Xavfsizlik.** `/api/chat` har so'rovda Telegram `initData` ni bot tokeni bilan
HMAC-SHA256 orqali tekshiradi (`src/lib/telegram.ts`), 24 soatdan eski
ma'lumotni rad etadi va foydalanuvchi id bo'yicha so'rovlarni cheklaydi.
`TELEGRAM_BOT_TOKEN` productionda majburiy — u bo'lmasa route 500 qaytaradi.

## Claude sozlamalari (`src/app/api/chat/route.ts`)

| Sozlama | Qiymat | Nega |
| --- | --- | --- |
| `model` | `claude-opus-5` | Matematik aniqlik uchun eng kuchli variant. `.env.local` da `ANTHROPIC_MODEL` orqali almashtiriladi |
| `thinking` | `adaptive` | Model masalani yechishdan oldin o'ylab oladi |
| `output_config.effort` | `medium` | Chat uchun tezlik/narx muvozanati. `ANTHROPIC_EFFORT=high` bilan ko'tariladi |
| `max_tokens` | 16000 | Uzun reja yoki bosqichli yechim kesilib qolmasin |
| `cache_control` | `ephemeral` | System prompt uzun va o'zgarmas — keshdan o'qiladi, arzonroq |
| `fallbacks` | `claude-opus-4-8` | Model so'rovni rad etsa, zaxira modelda qayta ishlanadi. Kerak bo'lmasa o'chirsa bo'ladi |

## Tekshiruv

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## Keyingi qadamlar uchun g'oyalar

- Reja va o'zlashtirishni bazada saqlash (hozir faqat suhbat tarixi bor)
- Rasm yuborish (foydalanuvchi masala rasmini tashlasin) — Claude vision qo'llab-quvvatlaydi
- Test rejimi: N ta savol, avtomatik ball va xatolar tahlili
- Redis (Upstash) bilan jiddiy rate limiting
