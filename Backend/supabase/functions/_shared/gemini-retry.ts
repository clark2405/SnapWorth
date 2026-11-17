/**
 * Calls Gemini again, on the next model in line, when it's unavailable. At busy times it answers 500/503 ("the model
 * is overloaded") within a second or two, or never answers; one more try a moment later usually
 * goes through. Each try has its own time limit, and all of them together stay under `totalMs`,
 * so the person isn't kept waiting longer than before. The provider's own error is logged (never
 * returned), so the function's logs say why a call failed.
 */
export async function sendWithRetry(
  send: (signal: AbortSignal, attempt: number) => Promise<Response>,
  outer: AbortSignal,
  { attempts = 3, perAttemptMs, totalMs, label }: {
    attempts?: number;
    perAttemptMs: number;
    totalMs: number;
    label: string;
  },
): Promise<Response> {
  const started = Date.now();
  let last: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const left = totalMs - (Date.now() - started);
    if (left < 3000 && last) return last;
    const signal = AbortSignal.any([
      outer,
      AbortSignal.timeout(Math.min(perAttemptMs, Math.max(left, 1000))),
    ]);
    try {
      const response = await send(signal, attempt - 1);
      // 404: a fallback model this key can't use; the next one may work.
      if (![404, 500, 502, 503, 504].includes(response.status)) return response;
      last = response;
      const detail = await response.clone().text().catch(() => "");
      console.error(`${label}: provider ${response.status} on try ${attempt}: ${detail.slice(0, 300)}`);
    } catch (cause) {
      if (outer.aborted) throw cause;
      console.error(`${label}: try ${attempt} gave up: ${cause instanceof Error ? cause.name : cause}`);
      if (attempt === attempts || totalMs - (Date.now() - started) < 3000) throw cause;
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
