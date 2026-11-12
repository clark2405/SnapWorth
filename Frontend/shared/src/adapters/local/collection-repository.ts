import type { Collection, CollectionRepository } from '../../ports/collections';
import { ok } from '../../types/result';
import type { KeyValueStore } from './comment-repository';

/**
 * Where a build without a Supabase project keeps collections, and where a phone kept them before
 * they moved into accounts (they're moved from here; see the Supabase repository).
 */
export const deviceCollectionsKey = 'snapworth.collections.v1';

/** Collections kept on this device. `seed` fills a fresh install. */
export function createLocalCollectionRepository({
  store,
  seed = [],
}: {
  readonly store: KeyValueStore;
  readonly seed?: readonly Collection[];
}): CollectionRepository {
  let saved: Collection[] | null = null;

  async function load(): Promise<Collection[]> {
    if (saved) return saved;
    const text = await store.getItem(deviceCollectionsKey).catch(() => null);
    saved = text ? (JSON.parse(text) as Collection[]) : [...seed];
    return saved;
  }

  async function save(change: (all: Collection[]) => Collection[]) {
    saved = change(await load());
    await store.setItem(deviceCollectionsKey, JSON.stringify(saved)).catch(() => undefined);
    return ok(undefined);
  }

  return {
    async list() {
      return ok(await load());
    },
    create: (collection) =>
      save((all) => [...all.filter((entry) => entry.id !== collection.id), collection]),
    rename: (id, name) =>
      save((all) => all.map((entry) => (entry.id === id ? { ...entry, name } : entry))),
    setItems: (id, itemIds) =>
      save((all) => all.map((entry) => (entry.id === id ? { ...entry, itemIds } : entry))),
    remove: (id) => save((all) => all.filter((entry) => entry.id !== id)),
  };
}
