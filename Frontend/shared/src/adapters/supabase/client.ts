import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export interface SupabaseConfig {
  readonly url: string;
  /** The project's public anon key. Never a service-role key: this runs on the device. */
  readonly anonKey: string;
}

/**
 * The app's Supabase client. Sessions persist in the given storage (AsyncStorage on devices,
 * the browser's own storage on the web when none is given).
 */
export function createSupabaseClient(
  config: SupabaseConfig,
  storage?: SupportedStorage,
): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
