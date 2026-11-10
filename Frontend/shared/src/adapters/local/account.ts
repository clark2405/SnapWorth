import type { AccountObserver } from '../../ports/account';

/** Without a Supabase project there's one account: whoever has this device. */
export const deviceAccount: AccountObserver = {
  observe(listener) {
    listener('device');
    return () => undefined;
  },
};
