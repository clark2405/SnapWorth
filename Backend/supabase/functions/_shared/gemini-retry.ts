/**
 * Collects unique, non-empty Gemini API keys in priority order (e.g. `AI_API_KEY`, `AI_API_KEY_2`).
 */
export function resolveApiKeys(...candidates: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      keys.push(trimmed);
    }
  }
  return keys;
}

export interface GeminiKeyPool {
  readonly keys: readonly string[];
  preferredIndex(now?: number): number;
  markRateLimited(index: number, now?: number, cooldownMs?: number): void;
  markSlowOrFailed(index: number): void;
  markSucceeded(index: number): void;
}

/**
 * Remembers which Gemini key is currently healthy inside a warm Edge Function instance.
 * When one key hits a rate limit (429) or times out / errors, traffic shifts to the other key
 * and automatically shifts back if the second key later hits a limit ("vice versa").
 */
export function createGeminiKeyPool(keys: readonly string[]): GeminiKeyPool {
  let activeIndex = 0;
  const cooldownUntil = keys.map(() => 0);

  return {
    keys,
    preferredIndex(now = Date.now()) {
      if (keys.length <= 1) return 0;
      if ((cooldownUntil[activeIndex] ?? 0) <= now) return activeIndex;
      for (let offset = 1; offset < keys.length; offset += 1) {
        const candidate = (activeIndex + offset) % keys.length;
        if ((cooldownUntil[candidate] ?? 0) <= now) {
          activeIndex = candidate;
          return candidate;
        }
      }
      // Every key is cooling down: pick the one whose cooldown ends soonest.
      let soonest = 0;
      for (let i = 1; i < keys.length; i += 1) {
        if ((cooldownUntil[i] ?? 0) < (cooldownUntil[soonest] ?? 0)) soonest = i;
      }
      activeIndex = soonest;
      return soonest;
    },
    markRateLimited(index, now = Date.now(), cooldownMs = 60_000) {
      if (index >= 0 && index < cooldownUntil.length) {
        cooldownUntil[index] = now + cooldownMs;
      }
      if (keys.length > 1) activeIndex = (index + 1) % keys.length;
    },
    markSlowOrFailed(index) {
      if (keys.length > 1) activeIndex = (index + 1) % keys.length;
    },
    markSucceeded(index) {
      if (index >= 0 && index < keys.length) {
        cooldownUntil[index] = 0;
        activeIndex = index;
      }
    },
  };
}

export interface GeminiAttemptTarget {
  readonly apiKey: string;
  readonly keyIndex: number;
  readonly model: string;
  readonly isPrimaryModel: boolean;
  readonly attempt: number;
}

/**
 * Calls Gemini with automatic key failover (429, timeout, 5xx) and model fallback (`AI_MODEL` ->
 * `AI_FALLBACK_MODELS`). Each try has its own time limit, and all tries stay under `totalMs`,
 * so the caller isn't kept waiting longer than before. The provider's own error is logged (never
 * returned, and keys are never logged), so the function's logs say why a call failed.
 */
export async function sendWithRetry(
  send: (signal: AbortSignal, target: GeminiAttemptTarget) => Promise<Response>,
  outer: AbortSignal,
  {
    keyPool,
    models,
    attempts,
    perAttemptMs,
    totalMs,
    label,
  }: {
    keyPool: GeminiKeyPool;
    models: readonly string[];
    attempts?: number;
    perAttemptMs: number;
    totalMs: number;
    label: string;
  },
): Promise<Response> {
  const started = Date.now();
  const maxAttempts = attempts ?? Math.min(4, Math.max(3, models.length + keyPool.keys.length - 1));
  const rateLimitedKeys = new Set<number>();
  let keyIndex = keyPool.preferredIndex(started);
  let modelIndex = 0;
  let last: Response | null = null;

  const pickNextKey = (current: number): number | null => {
    for (let offset = 1; offset < keyPool.keys.length; offset += 1) {
      const candidate = (current + offset) % keyPool.keys.length;
      if (!rateLimitedKeys.has(candidate)) return candidate;
    }
    return null;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const left = totalMs - (Date.now() - started);
    if (left < 3000 && last) return last;
    const signal = AbortSignal.any([
      outer,
      AbortSignal.timeout(Math.min(perAttemptMs, Math.max(left, 1000))),
    ]);
    const apiKey = keyPool.keys[keyIndex] ?? "";
    const model = models[Math.min(modelIndex, models.length - 1)] ?? models[0] ?? "";
    try {
      const response = await send(signal, {
        apiKey,
        keyIndex,
        model,
        isPrimaryModel: modelIndex === 0,
        attempt: attempt - 1,
      });

      if (response.status === 429) {
        rateLimitedKeys.add(keyIndex);
        keyPool.markRateLimited(keyIndex);
        last = response;
        const detail = await response.clone().text().catch(() => "");
        console.error(
          `${label}: provider 429 on key #${keyIndex + 1} (${model}) try ${attempt}: ${detail.slice(0, 300)}`,
        );
        const nextKey = pickNextKey(keyIndex);
        if (nextKey === null || attempt === maxAttempts) return response;
        // Switch directly to the other key on the same configured model (no long backoff needed).
        keyIndex = nextKey;
        continue;
      }

      // 404: a fallback model this key can't use; 5xx: overloaded or transient provider fault.
      if (![404, 500, 502, 503, 504].includes(response.status)) {
        if (response.ok) keyPool.markSucceeded(keyIndex);
        return response;
      }

      last = response;
      const detail = await response.clone().text().catch(() => "");
      console.error(
        `${label}: provider ${response.status} on key #${keyIndex + 1} (${model}) try ${attempt}: ${detail.slice(0, 300)}`,
      );
      keyPool.markSlowOrFailed(keyIndex);
      const nextKey = pickNextKey(keyIndex);
      if (nextKey !== null) keyIndex = nextKey;
      modelIndex = Math.min(modelIndex + 1, models.length - 1);
    } catch (cause) {
      if (outer.aborted) throw cause;
      console.error(
        `${label}: key #${keyIndex + 1} (${model}) try ${attempt} gave up: ${
          cause instanceof Error ? cause.name : cause
        }`,
      );
      keyPool.markSlowOrFailed(keyIndex);
      if (attempt === maxAttempts || totalMs - (Date.now() - started) < 3000) throw cause;
      const nextKey = pickNextKey(keyIndex);
      if (nextKey !== null) keyIndex = nextKey;
      modelIndex = Math.min(modelIndex + 1, models.length - 1);
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
  }
  return last!;
}

/**
 * The models to try in turn: the configured one, then lighter ones that are rarely overloaded
 * when it is ("This model is currently experiencing high demand"). `AI_FALLBACK_MODELS` (comma
 * separated) replaces the default list.
 */
export function modelsToTry(primary: string, fallbacks: string | undefined): string[] {
  const list = (fallbacks ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => /^[a-z0-9.-]+$/.test(model));
  return [primary, ...list.filter((model) => model !== primary)];
}
