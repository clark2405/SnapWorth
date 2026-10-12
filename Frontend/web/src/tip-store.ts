import type { TipStore } from '@snapworth/shared/features/tips';

const key = 'snapworth.tipsRetired';

/** Remembers which in-place tips this browser has learned; blocked storage shows them again. */
export const browserTipStore: TipStore = {
  async load() {
    try {
      const ids: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  },
  async save(retired) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(retired));
    } catch {
      // Private mode or blocked storage: tips may come back next visit.
    }
  },
};
