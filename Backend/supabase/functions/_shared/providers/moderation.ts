// Provider-neutral moderation for public text. Vendor responses are normalised here into one
// verdict; nothing outside this file knows which provider is in use.

export type Verdict =
  | { readonly decision: 'approved'; readonly ref: string }
  | { readonly decision: 'held'; readonly ref: string; readonly reason: string };

/** A provider failed in a way worth retrying; the content stays pending (and so not public). */
export class ModerationUnavailable extends Error {}

export interface ModerationProvider {
  readonly name: string;
  screen(text: string, signal?: AbortSignal): Promise<Verdict>;
}

/**
 * Deterministic rules for local development and tests: holds harassment, scams and attempts to
 * take a sale off-platform. Not a substitute for a real classifier in production.
 */
export function rulesProvider(): ModerationProvider {
  const rules: readonly { readonly reason: string; readonly pattern: RegExp }[] = [
    { reason: 'off-platform contact', pattern: /\b(dm|pm|text|viber|whats\s?app|telegram)\s+me\b/i },
    { reason: 'off-platform contact', pattern: /(?:\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/ },
    { reason: 'scam accusation', pattern: /\b(scam(?:mer|ming)?|fraud)\b/i },
    { reason: 'harassment', pattern: /\b(idiot|stupid|moron|loser|shut up)\b/i },
    { reason: 'link', pattern: /\bhttps?:\/\/|www\./i },
  ];
  return {
    name: 'rules',
    screen(text) {
      const hit = rules.find((rule) => rule.pattern.test(text));
      return Promise.resolve(
        hit
          ? { decision: 'held', ref: 'rules', reason: hit.reason }
          : { decision: 'approved', ref: 'rules' },
      );
    },
  };
}

/** OpenAI's moderation endpoint (free to call). Any flagged category holds the content. */
export function openAiProvider(apiKey: string, fetcher: typeof fetch = fetch): ModerationProvider {
  return {
    name: 'openai',
    async screen(text, signal) {
      let response: Response;
      try {
        response = await fetcher('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
          signal,
        });
      } catch (cause) {
        throw new ModerationUnavailable('Moderation provider unreachable', { cause });
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ModerationUnavailable(`Moderation provider returned ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`Moderation request rejected with ${response.status}`);
      }
      const payload = (await response.json()) as {
        id?: string;
        results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
      };
      const result = payload.results?.[0];
      if (!result || typeof result.flagged !== 'boolean') {
        throw new ModerationUnavailable('Moderation provider sent an unexpected response');
      }
      const ref = `openai:${payload.id ?? 'unknown'}`;
      if (!result.flagged) return { decision: 'approved', ref };
      const categories = Object.entries(result.categories ?? {})
        .filter(([, flagged]) => flagged)
        .map(([category]) => category);
      return { decision: 'held', ref, reason: categories.join(', ') || 'flagged' };
    },
  };
}

/**
 * Picks the provider from the environment. With none configured there is no provider at all,
 * and callers must hold content for review rather than publish it unchecked.
 */
export function providerFromEnv(env: (name: string) => string | undefined): ModerationProvider | null {
  const choice = env('MODERATION_PROVIDER')?.trim().toLowerCase();
  if (choice === 'openai') {
    const key = env('OPENAI_API_KEY');
    return key ? openAiProvider(key) : null;
  }
  if (choice === 'rules') return rulesProvider();
  return null;
}
