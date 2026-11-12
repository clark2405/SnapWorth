import type { SupabaseClient } from '@supabase/supabase-js';

import type { Collection, CollectionRepository } from '../../ports/collections';
import { isUuid, newUuid } from '../../types/ids';
import { err, ok } from '../../types/result';
import { deviceCollectionsKey } from '../local/collection-repository';
import type { KeyValueStore } from '../local/comment-repository';
import { toAppError } from './errors';

interface CollectionRow {
  readonly id: string;
  readonly name: string;
  readonly collection_items: readonly { readonly scan_id: string; readonly added_at: string }[];
}

const fromRow = (row: CollectionRow): Collection => ({
  id: row.id,
  name: row.name,
  itemIds: [...(row.collection_items ?? [])]
    .sort((a, b) => a.added_at.localeCompare(b.added_at))
    .map((item) => item.scan_id),
});

/** Only saved scans can be in a stored collection; the sample items are a preview. */
const scansOnly = (itemIds: readonly string[]) => itemIds.filter(isUuid);

/**
 * Collections stored in Supabase (`collections` and `collection_items`). Row-level security keeps
 * them to their owner, who is whoever is signed in; this adapter only translates.
 *
 * Collections this phone kept before they were stored (under `deviceCollectionsKey` in `device`)
 * move into the account the first time it lists them here: each one holding at least one of the
 * account's own scans is copied in with those scans, then left off the phone. The rest (another
 * account's, or ones holding only sample items) stay where they were, so nothing is lost and
 * nobody else's collections are taken.
 */
export function createSupabaseCollectionRepository(
  client: SupabaseClient,
  { device }: { readonly device?: KeyValueStore } = {},
): CollectionRepository {
  const adopted = new Set<string>();

  async function insertItems(collectionId: string, itemIds: readonly string[]) {
    const rows = scansOnly(itemIds).map((scanId) => ({
      collection_id: collectionId,
      scan_id: scanId,
    }));
    if (rows.length === 0) return { error: null };
    // Already in it is fine: that's the same answer.
    return client
      .from('collection_items')
      .upsert(rows, { onConflict: 'collection_id,scan_id', ignoreDuplicates: true });
  }

  /** Moves this phone's own collections into the signed-in account, once per account. */
  async function adoptDeviceCollections() {
    if (!device) return;
    const { data: session } = await client.auth.getSession();
    const accountId = session.session?.user.id;
    if (!accountId || adopted.has(accountId)) return;
    adopted.add(accountId);

    const text = await device.getItem(deviceCollectionsKey).catch(() => null);
    const kept = text ? (JSON.parse(text) as Collection[]) : [];
    if (!kept.some((collection) => collection.itemIds.some(isUuid))) return;
    // The account's own scans: row-level security returns no one else's.
    const { data: scans, error } = await client.from('scan_history').select('id');
    if (error || !Array.isArray(scans)) {
      adopted.delete(accountId);
      return;
    }
    const own = new Set((scans as { id: string }[]).map((scan) => scan.id));

    const remaining: Collection[] = [];
    for (const collection of kept) {
      const mine = collection.itemIds.filter((id) => own.has(id));
      if (mine.length === 0) {
        remaining.push(collection);
        continue;
      }
      const id = isUuid(collection.id) ? collection.id : newUuid();
      const made = await client.from('collections').insert({ id, name: collection.name });
      const filled = made.error ? made : await insertItems(id, mine);
      if (filled.error) {
        if (!made.error) await client.from('collections').delete().eq('id', id);
        remaining.push(collection);
        continue;
      }
      // Another account's things stay on the phone, for that account to take.
      const others = collection.itemIds.filter((itemId) => !own.has(itemId));
      if (others.some(isUuid)) remaining.push({ ...collection, itemIds: others });
    }
    await device.setItem(deviceCollectionsKey, JSON.stringify(remaining)).catch(() => undefined);
  }

  return {
    async list() {
      await adoptDeviceCollections().catch(() => undefined);
      const { data, error } = await client
        .from('collections')
        .select('id, name, collection_items(scan_id, added_at)')
        .order('created_at', { ascending: true });
      if (error) return err(toAppError(error, 'load_collections', 'collection'));
      return ok((data as unknown as CollectionRow[]).map(fromRow));
    },

    async create({ id, name, itemIds }) {
      const made = await client.from('collections').insert({ id, name });
      if (made.error) return err(toAppError(made.error, 'save_collection', 'collection'));
      const filled = await insertItems(id, itemIds);
      if (filled.error) return err(toAppError(filled.error, 'save_collection', 'collection'));
      return ok(undefined);
    },

    async rename(id, name) {
      const { data, error } = await client
        .from('collections')
        .update({ name })
        .eq('id', id)
        .select('id');
      if (error) return err(toAppError(error, 'save_collection', 'collection'));
      return data.length > 0
        ? ok(undefined)
        : err({ kind: 'authorization', code: 'not_found_or_denied' });
    },

    async setItems(id, itemIds) {
      const keep = scansOnly(itemIds);
      // Take out what's no longer chosen, then put in what's new.
      let out = client.from('collection_items').delete().eq('collection_id', id);
      if (keep.length > 0) out = out.not('scan_id', 'in', `(${keep.join(',')})`);
      const removed = await out;
      if (removed.error) return err(toAppError(removed.error, 'save_collection', 'collection'));
      const added = await insertItems(id, keep);
      if (added.error) return err(toAppError(added.error, 'save_collection', 'collection'));
      return ok(undefined);
    },

    async remove(id) {
      const { error } = await client.from('collections').delete().eq('id', id);
      if (error) return err(toAppError(error, 'save_collection', 'collection'));
      return ok(undefined);
    },
  };
}
