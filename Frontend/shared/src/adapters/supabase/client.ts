import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export interface SupabaseConfig {
  readonly url: string;
  /** The project's public anon key. Never a service-role key: this runs on the device. */
  readonly anonKey: string;
}

/** Auth storage that never touches `window`. Used while Expo Router renders the web app on Node. */
const serverAuthStorage: SupportedStorage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Session storage for this runtime. AsyncStorage (and the browser's localStorage) read `window`,
 * which does not exist during Expo's Node render — so the server always gets a no-op store.
 */
export function authStorageForRuntime(preferred?: SupportedStorage): SupportedStorage | undefined {
  return isBrowser() ? preferred : serverAuthStorage;
}

/**
 * The app's Supabase client. Sessions persist in the given storage (AsyncStorage on devices,
 * the browser's own storage on the web when none is given).
 */
export function createSupabaseClient(
  config: SupabaseConfig,
  storage?: SupportedStorage,
): SupabaseClient {
  const browser = isBrowser();
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: authStorageForRuntime(storage),
      persistSession: browser,
      autoRefreshToken: browser,
      detectSessionInUrl: false,
    },
  });
}
