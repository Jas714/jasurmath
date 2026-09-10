/**
 * Xotirada saqlanadigan token-bucket limiter.
 *
 * Diqqat: limiter jarayon xotirasida yashaydi. Vercel kabi serverless
 * muhitda har bir instans o'z hisobini yuritadi, ya'ni bu qat'iy kafolat emas -
 * faqat bitta manba bir instansni bosib ketishidan himoya. Qat'iy limit kerak
 * bo'lsa Redis (masalan Upstash) ga o'tkazing.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface Limiter {
  /** Ruxsat bo'lsa true qaytaradi va bitta token yechadi. */
  take(key: string): boolean;
  /** Kalitda nechta so'rov qolganini ko'rsatadi (token yechmaydi). */
  remaining(key: string): number;
}

const MAX_BUCKETS = 5000;

export function createLimiter(options: {
  /** Ketma-ket nechta so'rov qilish mumkin. */
  capacity: number;
  /** Shu vaqt ichida to'liq tiklanadi (sekund). */
  windowSeconds: number;
}): Limiter {
  const { capacity, windowSeconds } = options;
  const refillPerSecond = capacity / windowSeconds;
  const buckets = new Map<string, Bucket>();

  function refill(key: string, now: number): Bucket {
    const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    const elapsed = (now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.updatedAt = now;
    return bucket;
  }

  return {
    take(key) {
      const now = Date.now();
      const bucket = refill(key, now);

      if (bucket.tokens < 1) {
        buckets.set(key, bucket);
        return false;
      }

      bucket.tokens -= 1;
      buckets.set(key, bucket);

      if (buckets.size > MAX_BUCKETS) {
        for (const [otherKey, other] of buckets) {
          if (now - other.updatedAt > windowSeconds * 1000) {
            buckets.delete(otherKey);
          }
        }
      }
      return true;
    },

    remaining(key) {
      return Math.floor(refill(key, Date.now()).tokens);
    },
  };
}
