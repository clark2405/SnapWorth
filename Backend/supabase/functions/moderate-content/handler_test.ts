import { assertEquals } from 'jsr:@std/assert@1';

import { rulesProvider } from '../_shared/providers/moderation.ts';
import { handleModeration } from './handler.ts';
import type { ModerationDb } from './targets.ts';

const id = '00000000-0000-4000-fc00-000000000001';

/** A database with one row, that records what moderation read and wrote. */
function fakeDb(table: string, row: Record<string, unknown>) {
  const log = {
    selected: [] as string[],
    updates: [] as Record<string, unknown>[],
    filters: [] as string[],
  };
  const db: ModerationDb = {
    from(name) {
      return {
        select(columns) {
          log.selected.push(`${name}: ${columns}`);
          return {
            eq: (_column, value) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: name === table && value === id ? row : null,
                  error: null,
                }),
            }),
          };
        },
        update(values) {
          log.updates.push(values);
          return {
            eq: (column, value) => ({
              eq: (column2, value2) => {
                log.filters.push(`${column}=${value}`, `${column2}=${value2}`);
                Object.assign(row, values);
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };
    },
  };
  return { db, log };
}

const post = (body: unknown) =>
  new Request('https://example.test/moderate-content', {
    method: 'POST',
    body: JSON.stringify(body),
  });

Deno.test('a listing is screened on its title and description, from the real columns', async () => {
  const { db, log } = fakeDb('listings', {
    title: 'Pentax K1000',
    description: 'Clean viewfinder. Text me on viber for a cheaper price.',
    moderation_status: 'pending',
  });
  const response = await handleModeration(post({ type: 'listing', id }), {
    db: () => db,
    provider: rulesProvider(),
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: 'held' });
  assertEquals(log.selected, ['listings: title, description, moderation_status']);
  assertEquals(log.updates[0]?.moderation_status, 'held');
  assertEquals(log.updates[0]?.moderation_ref, 'rules (off-platform contact)');
  // Only a row that is still pending can be settled.
  assertEquals(log.filters, [`id=${id}`, 'moderation_status=pending']);
});

Deno.test('a clean listing is approved', async () => {
  const { db, log } = fakeDb('listings', {
    title: 'Pentax K1000',
    description: 'Clean viewfinder, working light meter.',
    moderation_status: 'pending',
  });
  const response = await handleModeration(post({ type: 'listing', id }), {
    db: () => db,
    provider: rulesProvider(),
  });
  assertEquals(await response.json(), { status: 'approved' });
  assertEquals(log.updates[0]?.moderation_status, 'approved');
  assertEquals(typeof log.updates[0]?.moderated_at, 'string');
});

Deno.test('a title alone can get a listing held', async () => {
  const { db } = fakeDb('listings', {
    title: 'Call 0917 123 4567',
    description: '',
    moderation_status: 'pending',
  });
  const response = await handleModeration(post({ type: 'listing', id }), {
    db: () => db,
    provider: rulesProvider(),
  });
  assertEquals(await response.json(), { status: 'held' });
});

Deno.test('Hanap posts and feed posts are screened on their body', async () => {
  for (const [type, table] of [
    ['hanap', 'hanap_posts'],
    ['post', 'feed_posts'],
  ] as const) {
    const { db, log } = fakeDb(table, {
      body: 'Looking for a Nike windbreaker',
      moderation_status: 'pending',
    });
    const response = await handleModeration(post({ type, id }), {
      db: () => db,
      provider: rulesProvider(),
    });
    assertEquals(await response.json(), { status: 'approved' });
    assertEquals(log.selected, [`${table}: body, moderation_status`]);
  }
});

Deno.test('with no provider configured a listing is held, not published', async () => {
  const { db, log } = fakeDb('listings', {
    title: 'Pentax K1000',
    description: 'Fine.',
    moderation_status: 'pending',
  });
  const response = await handleModeration(post({ type: 'listing', id }), {
    db: () => db,
    provider: null,
  });
  assertEquals(await response.json(), { status: 'held' });
  assertEquals(log.updates[0]?.moderation_ref, 'no-provider-configured');
});

Deno.test('a listing already decided is left alone', async () => {
  const { db, log } = fakeDb('listings', {
    title: 'Pentax K1000',
    description: '',
    moderation_status: 'approved',
  });
  const response = await handleModeration(post({ type: 'listing', id }), {
    db: () => db,
    provider: rulesProvider(),
  });
  assertEquals(await response.json(), { status: 'approved' });
  assertEquals(log.updates, []);
});

Deno.test('an unknown id, a bad type and a bad method are refused', async () => {
  const { db } = fakeDb('listings', { title: 'x', description: '', moderation_status: 'pending' });
  const deps = { db: () => db, provider: rulesProvider() };
  const other = '00000000-0000-4000-fc00-0000000000ff';
  assertEquals((await handleModeration(post({ type: 'listing', id: other }), deps)).status, 404);
  assertEquals((await handleModeration(post({ type: 'profile', id }), deps)).status, 400);
  assertEquals((await handleModeration(post({ type: 'listing', id: 'nope' }), deps)).status, 400);
  assertEquals(
    (await handleModeration(new Request('https://example.test', { method: 'GET' }), deps)).status,
    405,
  );
});
