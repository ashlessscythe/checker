/** Sliding-window limiter. Per-process only (fine for a single Node instance). */

export function createRateLimiter(maxHits: number, windowMs: number) {
  const hitsById = new Map<string, number[]>();

  function tryConsume(id: string, now: number): boolean {
    const cutoff = now - windowMs;
    const prev = hitsById.get(id) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= maxHits) {
      hitsById.set(id, recent);
      return false;
    }
    recent.push(now);
    hitsById.set(id, recent);
    return true;
  }

  function reset() {
    hitsById.clear();
  }

  return { tryConsume, reset };
}

export const API_KEY_RATE_LIMIT_MAX = 60;
export const API_KEY_RATE_LIMIT_WINDOW_MS = 60_000;

export const apiKeyRateLimiter = createRateLimiter(
  API_KEY_RATE_LIMIT_MAX,
  API_KEY_RATE_LIMIT_WINDOW_MS
);
