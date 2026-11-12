import type { SupabaseClient } from '@supabase/supabase-js';

import type { AccountObserver } from '../../ports/account';

/** An account's id, or null for no session or an anonymous one (a guest, not an account). */
export function accountIdOf(
  session: { readonly user: { readonly id: string; readonly is_anonymous?: boolean } } | null,
): string | null {
  return session && !session.user.is_anonymous ? session.user.id : null;
}

/** Who is signed in to Supabase, following every sign-in and sign-out. */
export function createSupabaseAccountObserver(client: SupabaseClient): AccountObserver {
  return {
    observe(listener) {
      let active = true;
      // A sign-in or sign-out that lands first wins over the session read at the start.
      let heard = false;
      void client.auth.getSession().then(({ data }) => {
        if (active && !heard) listener(accountIdOf(data.session));
      });
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        heard = true;
        if (active) listener(accountIdOf(session));
      });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    },
  };
}
