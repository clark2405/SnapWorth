import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseClient } from './supabase/client';

declare const process: {
  env: Record<string, string | undefined>;
};

let client: SupabaseClient | undefined;

/**
 * Whether a Supabase project is set up for this build. Without one the apps still run (see
 * Backend/README.md): signing in starts a session on this device instead.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * The auth client, created on first use rather than on import: every screen that imports the
 * auth feature (and the web's static render) must load without a Supabase project configured.
 *
 * Sessions persist in AsyncStorage on device so Google OAuth (PKCE) can exchange its code after
 * the browser closes. `window.localStorage` is not available in React Native.
 */
export function getSupabase(config?: { url: string; anonKey: string }): SupabaseClient {
  if (client) return client;

  const supabaseUrl = config?.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = config?.anonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see Backend/README.md).',
    );
  }

  client = createSupabaseClient({ url: supabaseUrl, anonKey: supabaseAnonKey }, AsyncStorage);
  return client;
}
