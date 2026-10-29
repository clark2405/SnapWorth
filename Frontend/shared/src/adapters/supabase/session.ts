import type { SupabaseClient } from '@supabase/supabase-js';

import type { ModerationError } from '../../types/errors';
import { err, ok, type Result } from '../../types/result';
import { toAppError } from './errors';

const signingIn = new WeakMap<SupabaseClient, Promise<Result<string, ModerationError>>>();

/**
 * The signed-in user's id, signing this device in anonymously first if it has no session (until
 * email sign-in is wired up). Calls that arrive together share one sign-in: separate ones would
 * each create an account, leaving a device split across two.
 */
export function ensureSignedIn(client: SupabaseClient): Promise<Result<string, ModerationError>> {
  const pending = signingIn.get(client);
  if (pending) return pending;
  const attempt = (async (): Promise<Result<string, ModerationError>> => {
    const { data } = await client.auth.getSession();
    if (data.session) return ok(data.session.user.id);
    const signedIn = await client.auth.signInAnonymously();
    if (signedIn.error || !signedIn.data.user) {
      return err(toAppError(signedIn.error, 'authenticate'));
    }
    return ok(signedIn.data.user.id);
  })();
  signingIn.set(client, attempt);
  void attempt.finally(() => signingIn.delete(client));
  return attempt;
}
