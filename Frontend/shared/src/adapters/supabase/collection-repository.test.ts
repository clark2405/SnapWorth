import type { SupabaseClient } from '@supabase/supabase-js';

import type { Collection } from '../../ports/collections';
import { deviceCollectionsKey } from '../local/collection-repository';
import { createSupabaseCollectionRepository } from './collection-repository';

const scanA = '6f1c2a9e-4b7d-4c3e-9a1f-2d8e5b7c4a10';
const scanB = '0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const othersScan = '11111111-2222-4333-8444-555555555555';
const collectionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

interface Row {
  id: string;
  name: string;
}
interface Item {
  collection_id: string;
  scan_id: string;
  added_at: string;
}

/**
 * A stand-in Supabase holding one account's collections, as row-level security would show them:
 * `scan_history` answers with the account's own scans only, and putting anyone else's scan in a
 * collection is refused.
 */
function fakeSupabase({ ownScans = [scanA, scanB] as string[], accountId = 'ana' } = {}) {
  const state = { collections: [] as Row[], items: [] as Item[], offline: false, clock: 0 };
  const refused = { message: 'new row violates row-level security policy', code: '42501' };
  const failIfOffline = () => (state.offline ? { message: 'fetch failed' } : null);

  function deleteFrom(table: string) {
    const filters: ((row: Record<string, string>) => boolean)[] = [];
    const query = {
      eq(column: string, value: string) {
        filters.push((row) => row[column] === value);
        return query;
      },
      not(column: string, _op: string, list: string) {
        const values = list.slice(1, -1).split(',');
        filters.push((row) => !values.includes(row[column]!));
        return query;
      },
      then(resolve: (value: { error: unknown }) => void) {
        const error = failIfOffline();
        if (!error) {
          const keep = (row: object) =>
            !filters.every((match) => match(row as Record<string, string>));
          if (table === 'collections') {
            const gone = state.collections.filter((row) => !keep(row)).map((row) => row.id);
            state.collections = state.collections.filter(keep);
            state.items = state.items.filter((item) => !gone.includes(item.collection_id));
          } else state.items = state.items.filter(keep);
        }
        resolve({ error });
      },
    };
    return query;
  }

  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: accountId } } } }),
    },
    from: (table: string) => ({
      select: () =>
        table === 'scan_history'
          ? Promise.resolve({ data: ownScans.map((id) => ({ id })), error: failIfOffline() })
          : {
              order: () =>
                Promise.resolve({
                  data: state.collections.map((row) => ({
                    ...row,
                    collection_items: state.items.filter((item) => item.collection_id === row.id),
                  })),
                  error: failIfOffline(),
                }),
            },
      insert: (row: Row) => {
        const error = failIfOffline();
        if (!error) state.collections.push(row);
        return Promise.resolve({ error });
      },
      upsert: (rows: Omit<Item, 'added_at'>[]) => {
        const error =
          failIfOffline() ?? (rows.some((row) => !ownScans.includes(row.scan_id)) ? refused : null);
        if (!error) {
          for (const row of rows) {
            const there = state.items.some(
              (item) => item.collection_id === row.collection_id && item.scan_id === row.scan_id,
            );
            state.clock += 1;
            if (!there) state.items.push({ ...row, added_at: `2026-11-10T00:00:0${state.clock}Z` });
          }
        }
        return Promise.resolve({ error });
      },
      update: (values: { name: string }) => ({
        eq: (_column: string, id: string) => ({
          select: () => {
            const row = state.collections.find((entry) => entry.id === id);
            if (row) row.name = values.name;
            return Promise.resolve({ data: row ? [{ id }] : [], error: failIfOffline() });
          },
        }),
      }),
      delete: () => deleteFrom(table),
    }),
  } as unknown as SupabaseClient;
  return { client, state };
}

function memoryStore(saved?: readonly Collection[]) {
  const data = new Map<string, string>();
  if (saved) data.set(deviceCollectionsKey, JSON.stringify(saved));
  return {
    data,
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

it('keeps a collection and its scans, and leaves the sample items out', async () => {
  const { client } = fakeSupabase();
  const repository = createSupabaseCollectionRepository(client);

  const made = await repository.create({
    id: collectionId,
    name: 'Jackets',
    itemIds: [scanA, 'nike-neon-windbreaker', scanB],
  });

  expect(made.ok).toBe(true);
  expect(await repository.list()).toEqual({
    ok: true,
    value: [{ id: collectionId, name: 'Jackets', itemIds: [scanA, scanB] }],
  });
});

it('changes what’s in a collection by taking out and putting in only what changed', async () => {
  const { client, state } = fakeSupabase();
  const repository = createSupabaseCollectionRepository(client);
  await repository.create({ id: collectionId, name: 'Jackets', itemIds: [scanA] });
  const firstAdded = state.items[0]!.added_at;

  expect((await repository.setItems(collectionId, [scanA, scanB])).ok).toBe(true);
  // What was already in it keeps its place.
  expect(state.items.find((item) => item.scan_id === scanA)!.added_at).toBe(firstAdded);

  expect((await repository.setItems(collectionId, [scanB])).ok).toBe(true);
  expect(state.items.map((item) => item.scan_id)).toEqual([scanB]);

  expect((await repository.setItems(collectionId, [])).ok).toBe(true);
  expect(state.items).toEqual([]);
});

it('renames and deletes, and says when nothing was there to rename', async () => {
  const { client, state } = fakeSupabase();
  const repository = createSupabaseCollectionRepository(client);
  await repository.create({ id: collectionId, name: 'Jackets', itemIds: [scanA] });

  expect((await repository.rename(collectionId, 'Coats')).ok).toBe(true);
  expect(state.collections[0]!.name).toBe('Coats');
  expect(await repository.rename(othersScan, 'Mine')).toEqual({
    ok: false,
    error: { kind: 'authorization', code: 'not_found_or_denied' },
  });

  expect((await repository.remove(collectionId)).ok).toBe(true);
  expect(state.collections).toEqual([]);
  expect(state.items).toEqual([]);
});

it('reports a change it couldn’t make while offline', async () => {
  const { client, state } = fakeSupabase();
  const repository = createSupabaseCollectionRepository(client);
  state.offline = true;

  const made = await repository.create({ id: collectionId, name: 'Jackets', itemIds: [] });
  expect(made).toEqual({
    ok: false,
    error: { kind: 'offline', operation: 'save_collection', retryable: true },
  });
});

describe('collections kept on this phone before they moved into accounts', () => {
  const jackets: Collection = { id: 'c-1', name: 'Jackets', itemIds: [scanA, scanB] };
  const shared: Collection = { id: 'c-2', name: 'Shared phone', itemIds: [scanA, othersScan] };
  const someoneElses: Collection = { id: 'c-3', name: 'Not mine', itemIds: [othersScan] };
  const samples: Collection = {
    id: 'ukay-jackets',
    name: 'Ukay jackets',
    itemIds: ['teal-half-zip'],
  };

  it('move into the account that owns their things, once, and the rest stay', async () => {
    const { client, state } = fakeSupabase();
    const device = memoryStore([jackets, shared, someoneElses, samples]);
    const repository = createSupabaseCollectionRepository(client, { device });

    const listed = await repository.list();

    expect(listed.ok && listed.value.map((c) => [c.name, c.itemIds])).toEqual([
      ['Jackets', [scanA, scanB]],
      ['Shared phone', [scanA]],
    ]);
    // Another account's things, and the samples, are still on the phone; the moved ones aren't.
    expect(JSON.parse(device.data.get(deviceCollectionsKey)!)).toEqual([
      { ...shared, itemIds: [othersScan] },
      someoneElses,
      samples,
    ]);

    await repository.list();
    expect(state.collections).toHaveLength(2);
  });

  it('stay on the phone while the account can’t be reached', async () => {
    const { client, state } = fakeSupabase();
    state.offline = true;
    const device = memoryStore([jackets]);
    const repository = createSupabaseCollectionRepository(client, { device });

    expect((await repository.list()).ok).toBe(false);
    expect(JSON.parse(device.data.get(deviceCollectionsKey)!)).toEqual([jackets]);

    state.offline = false;
    const listed = await repository.list();
    expect(listed.ok && listed.value.map((c) => c.name)).toEqual(['Jackets']);
    expect(JSON.parse(device.data.get(deviceCollectionsKey)!)).toEqual([]);
  });
});
