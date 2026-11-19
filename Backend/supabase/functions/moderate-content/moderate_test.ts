import { assertEquals } from 'jsr:@std/assert@1';

import {
  geminiProvider,
  matchObviousProfanity,
  ModerationUnavailable,
  providerFromEnv,
  rulesProvider,
  type ModerationProvider,
} from '../_shared/providers/moderation.ts';
import { moderateComment, type CommentStore, type ModerationStatus } from './moderate.ts';

function memoryStore(body: string, status: ModerationStatus = 'pending') {
  const row = { body, status, ref: '' };
  const store: CommentStore = {
    get: (id) => Promise.resolve(id === 'c1' ? { body: row.body, status: row.status } : null),
    settle: (_id, next, ref) => {
      row.status = next;
      row.ref = ref;
      return Promise.resolve();
    },
  };
  return { store, row };
}

const failing = (error: Error): ModerationProvider => ({
  name: 'failing',
  screen: () => Promise.reject(error),
});

Deno.test('a clean comment is approved', async () => {
  const { store, row } = memoryStore('Looks fair to me, the zip is in great shape.');
  assertEquals(await moderateComment(store, rulesProvider(), 'c1'), {
    kind: 'settled',
    status: 'approved',
  });
  assertEquals(row.status, 'approved');
});

Deno.test('taking a sale off-platform is held, with the reason recorded', async () => {
  const { store, row } = memoryStore('DM me for cheaper prices, selling outside the app.');
  await moderateComment(store, rulesProvider(), 'c1');
  assertEquals(row.status, 'held');
  assertEquals(row.ref, 'rules (off-platform contact)');
});

Deno.test('a phone number is held', async () => {
  const { store, row } = memoryStore('Call 0917 123 4567 to buy');
  await moderateComment(store, rulesProvider(), 'c1');
  assertEquals(row.status, 'held');
});

Deno.test('with no provider configured, comments are held for review (fail closed)', async () => {
  const { store, row } = memoryStore('Nice find!');
  assertEquals(await moderateComment(store, null, 'c1'), { kind: 'settled', status: 'held' });
  assertEquals(row.ref, 'no-provider-configured');
});

Deno.test('a provider outage leaves the comment pending so it can be retried', async () => {
  const { store, row } = memoryStore('Nice find!');
  const outcome = await moderateComment(store, failing(new ModerationUnavailable('down')), 'c1');
  assertEquals(outcome, { kind: 'retry_later' });
  assertEquals(row.status, 'pending');
});

Deno.test('an unexpected provider error holds the comment rather than publishing it', async () => {
  const { store, row } = memoryStore('Nice find!');
  await moderateComment(store, failing(new Error('bad request')), 'c1');
  assertEquals(row.status, 'held');
});

Deno.test('an already-decided comment is left alone', async () => {
  const { store, row } = memoryStore('DM me', 'approved');
  assertEquals(await moderateComment(store, rulesProvider(), 'c1'), {
    kind: 'settled',
    status: 'approved',
  });
  assertEquals(row.status, 'approved');
});

Deno.test('an unknown comment is reported as not found', async () => {
  const { store } = memoryStore('x');
  assertEquals(await moderateComment(store, rulesProvider(), 'missing'), { kind: 'not_found' });
});

Deno.test('provider selection: nothing configured means no provider', () => {
  assertEquals(providerFromEnv(() => undefined), null);
  assertEquals(providerFromEnv((n) => (n === 'MODERATION_PROVIDER' ? 'gemini' : undefined)), null);
  assertEquals(providerFromEnv((n) => (n === 'MODERATION_PROVIDER' ? 'rules' : undefined))?.name, 'rules');
  const gemini = providerFromEnv((n) =>
    n === 'MODERATION_PROVIDER' ? 'gemini' : n === 'AI_API_KEY_2' ? 'second-key' : undefined,
  );
  assertEquals(gemini?.name, 'gemini');
});

Deno.test('the word list catches what slipped through before, English and Filipino', () => {
  // "FUCKK" was approved on a live post: the old short list only knew "fuck" exactly.
  for (const text of ['Is it worth it? FUCKK', 'f u c k this', 'gago ka', 'putangina mo', 'g4g0']) {
    assertEquals(matchObviousProfanity(text), true, text);
  }
  for (const text of ['Too expensive for a used fan', 'Looks worn but fair', 'Bobby the seller']) {
    assertEquals(matchObviousProfanity(text), false, text);
  }
});

Deno.test('severe words remove a comment, but only hold a post for a moderator', async () => {
  const comment = memoryStore('Is it worth it? FUCKK');
  assertEquals(await moderateComment(comment.store, rulesProvider(), 'c1'), {
    kind: 'settled',
    status: 'removed',
  });
  const post = memoryStore('Is it worth it? FUCKK');
  assertEquals(
    await moderateComment(post.store, rulesProvider(), 'c1', undefined, { allowAutoRemove: false }),
    { kind: 'settled', status: 'held' },
  );
  assertEquals(post.row.ref.startsWith('word-list ('), true);
});

function gemini(reply: unknown, status = 200) {
  const calls: string[] = [];
  const fetcher = (url: string) => {
    calls.push(url);
    return Promise.resolve(
      new Response(
        status === 200
          ? JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] })
          : 'busy',
        { status },
      ),
    );
  };
  return { provider: geminiProvider({ apiKey: 'key', fetch: fetcher as typeof fetch }), calls };
}

Deno.test('Gemini: severe words are decided without asking it', async () => {
  const { provider, calls } = gemini({ decision: 'approved', reason: null });
  const verdict = await provider.screen('gago');
  assertEquals(verdict.decision, 'removed');
  assertEquals(calls.length, 0);
});

Deno.test('Gemini: its decision is used for everything else', async () => {
  const held = await gemini({ decision: 'held', reason: 'off-platform contact' }).provider.screen(
    'message me on viber',
  );
  assertEquals(held, {
    decision: 'held',
    ref: 'gemini:gemini-3.5-flash-lite',
    reason: 'off-platform contact',
  });
  const approved = await gemini({ decision: 'approved', reason: null }).provider.screen('Fair price');
  assertEquals(approved.decision, 'approved');
});

Deno.test('Gemini: a rate limit is retryable, so the item stays pending', async () => {
  let retryable = false;
  try {
    await gemini(null, 429).provider.screen('Nice find');
  } catch (error) {
    retryable = error instanceof ModerationUnavailable;
  }
  assertEquals(retryable, true);
});
