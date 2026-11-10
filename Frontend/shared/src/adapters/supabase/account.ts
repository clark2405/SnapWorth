import type { SupabaseClient } from '@supabase/supabase-js';

import type { AccountObserver } from '../../ports/account';

/** Who is signed in to Supabase, following every sign-in and sign-out. */
export function createSupabaseAccountObserver(client: SupabaseClient): AccountObserver {
  return {
    observe(listener) {
      let active = true;
      // A sign-in or sign-out that lands first wins over the session read at the start.
      let heard = false;
      void client.auth.getSession().then(({ data }) => {
        if (active && !heard) listener(data.session?.user.id ?? null);
      });
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        heard = true;
        if (active) listener(session?.user.id ?? null);
      });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    },
  };
}
