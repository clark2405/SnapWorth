import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see Backend/README.md).',
    );
  }

  const isBrowser = typeof window !== 'undefined';
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // If on the server, provide a dummy storage object that does nothing.
      // If in the browser, safely use standard local storage.
      storage: isBrowser
        ? window.localStorage
        : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
      autoRefreshToken: isBrowser,
      persistSession: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  });
  return client;
}
