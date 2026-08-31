/**
 * Juda oddiy, xotirada saqlanadigan token-bucket limiter.
 *
 * Diqqat: bu limiter jarayon xotirasida yashaydi. Vercel kabi serverless
 * muhitda har bir instans o'z hisobini yuritadi, ya'ni bu qat'iy kafolat emas -
 * faqat bitta foydalanuvchi bir instansni bosib ketishidan himoya. Qat'iy limit
 * kerak bo'lsa Redis (masalan Upstash) ga o'tkazing.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const CAPACITY = 12; // ketma-ket nechta so'rov qilish mumkin
const REFILL_PER_SECOND = 12 / 60; // daqiqasiga 12 ta so'rov
const MAX_BUCKETS = 5000;

const buckets = new Map<string, Bucket>();

export function takeToken(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };

  const elapsedSeconds = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(
    CAPACITY,
    bucket.tokens + elapsedSeconds * REFILL_PER_SECOND,
  );
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);

  if (buckets.size > MAX_BUCKETS) evictStale(now);
  return true;
}

function evictStale(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 10 * 60 * 1000) buckets.delete(key);
  }
}
