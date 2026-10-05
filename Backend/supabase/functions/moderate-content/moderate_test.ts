import { assertEquals } from 'jsr:@std/assert@1';

import {
  ModerationUnavailable,
  openAiProvider,
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
  assertEquals(providerFromEnv((n) => (n === 'MODERATION_PROVIDER' ? 'openai' : undefined)), null);
  assertEquals(providerFromEnv((n) => (n === 'MODERATION_PROVIDER' ? 'rules' : undefined))?.name, 'rules');
});

Deno.test('OpenAI: flagged categories hold the content', async () => {
  const fetcher = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'modr-1',
          results: [{ flagged: true, categories: { harassment: true, violence: false } }],
        }),
      ),
    );
  const verdict = await openAiProvider('key', fetcher as typeof fetch).screen('text');
  assertEquals(verdict, { decision: 'held', ref: 'openai:modr-1', reason: 'harassment' });
});

Deno.test('OpenAI: rate limits and outages are retryable', async () => {
  for (const status of [429, 503]) {
    const fetcher = () => Promise.resolve(new Response('busy', { status }));
    let retryable = false;
    try {
      await openAiProvider('key', fetcher as typeof fetch).screen('text');
    } catch (error) {
      retryable = error instanceof ModerationUnavailable;
    }
    assertEquals(retryable, true, `status ${status}`);
  }
});
