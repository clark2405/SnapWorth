import type { SukiRepository } from '../../ports/suki';
import { ok } from '../../types/result';
import type { KeyValueStore } from './comment-repository';

const storageKey = 'snapworth.suki.v1';

/**
 * Suki discounts kept on this device, for a build without a Supabase project. `seed` fills a
 * fresh install, keyed `seller:<buyer's id>` for a discount the viewer gives, or
 * `buyer:<seller's id>` for one they get.
 */
export function createLocalSukiRepository({
  store,
  seed = {},
}: {
  readonly store: KeyValueStore;
  readonly seed?: Readonly<Record<string, number>>;
}): SukiRepository {
  let saved: Record<string, number> | null = null;

  async function load(): Promise<Record<string, number>> {
    if (saved) return saved;
    const text = await store.getItem(storageKey).catch(() => null);
    saved = text ? (JSON.parse(text) as Record<string, number>) : { ...seed };
    return saved;
  }

  return {
    async discountWith(otherUserId, iAmSeller) {
      const all = await load();
      return ok(all[`${iAmSeller ? 'seller' : 'buyer'}:${otherUserId}`] ?? null);
    },

    async set(buyerId, discountPct) {
      const all = await load();
      const key = `seller:${buyerId}`;
      const next = { ...all };
      if (discountPct === null) delete next[key];
      else next[key] = discountPct;
      saved = next;
      await store.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      return ok(undefined);
    },
  };
}
