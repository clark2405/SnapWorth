import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemePreference, ThemePreferenceStore } from '@snapworth/shared/design';

const key = 'snapworth.appearance';
const valid = new Set<ThemePreference>(['system', 'light', 'dark']);

/** Remembers the appearance chosen in Profile across launches. */
export const deviceThemeStore: ThemePreferenceStore = {
  async load() {
    const stored = await AsyncStorage.getItem(key).catch(() => null);
    return stored && valid.has(stored as ThemePreference) ? (stored as ThemePreference) : null;
  },
  async save(preference) {
    await AsyncStorage.setItem(key, preference).catch(() => undefined);
  },
};
