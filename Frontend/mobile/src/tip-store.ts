import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TipStore } from '@snapworth/shared/features/tips';

const key = 'snapworth.tipsRetired';

/** Remembers which in-place tips this device has learned, across launches. */
export const deviceTipStore: TipStore = {
  async load() {
    const stored = await AsyncStorage.getItem(key).catch(() => null);
    try {
      const ids: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  },
  async save(retired) {
    await AsyncStorage.setItem(key, JSON.stringify(retired)).catch(() => undefined);
  },
};
