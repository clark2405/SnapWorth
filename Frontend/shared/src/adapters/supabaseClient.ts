import { createClient } from '@supabase/supabase-js';

declare const process: {
  env: Record<string, string | undefined>;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // If on the server, provide a dummy storage object that does nothing.
    // If in the browser, safely use standard local storage.
    storage: isBrowser ? window.localStorage : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});