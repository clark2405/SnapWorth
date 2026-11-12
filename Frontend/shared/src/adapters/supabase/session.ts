import type { SupabaseClient } from '@supabase/supabase-js';

import type { ModerationError } from '../../types/errors';
import { err, ok, type Result } from '../../types/result';

/**
 * The signed-in person's id for something only an account may do (post, vote, save, message,
 * snap), or an authorization error when nobody is signed in.
 *
 * This never creates a session. It once signed the device in anonymously when it had none, so
 * that writes always had an author; but then every visit to the Feed, Market, Chats or History
 * made an account, guests looked like members, and logging out was undone by the next screen.
 * SnapWorth's accounts are email and Google, and the screens ask for one (`useAccountGate`)
 * before any of these actions, so reads work as the signed-out (anon) role and writes need a
 * real account. An old anonymous session left on a device by an earlier build counts as signed
 * out too, the same as in `SessionProvider`.
 */
export async function requireSignedIn(
  client: SupabaseClient,
): Promise<Result<string, ModerationError>> {
  const { data, error } = await client.auth.getSession();
  const user = data?.session?.user;
  if (error || !user || user.is_anonymous) {
    return err({ kind: 'authorization', code: 'not_found_or_denied' });
  }
  return ok(user.id);
}
