import type { SupabaseClient } from '@supabase/supabase-js';

import { requireSignedIn } from './session';

function clientWith(session: unknown, error: unknown = null) {
  const signInAnonymously = jest.fn();
  const client = {
    auth: { getSession: async () => ({ data: { session }, error }), signInAnonymously },
  };
  return { client: client as unknown as SupabaseClient, signInAnonymously };
}

describe('requireSignedIn', () => {
  it('returns the signed-in account’s id', async () => {
    const { client } = clientWith({ user: { id: 'usr_1', is_anonymous: false } });
    expect(await requireSignedIn(client)).toEqual({ ok: true, value: 'usr_1' });
  });

  it('refuses when nobody is signed in, and signs nobody in', async () => {
    const { client, signInAnonymously } = clientWith(null);
    expect(await requireSignedIn(client)).toEqual({
      ok: false,
      error: { kind: 'authorization', code: 'not_found_or_denied' },
    });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('treats an anonymous session left by an earlier build as signed out', async () => {
    const { client, signInAnonymously } = clientWith({
      user: { id: 'anon_1', is_anonymous: true },
    });
    expect((await requireSignedIn(client)).ok).toBe(false);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('refuses when the session can’t be read', async () => {
    const { client } = clientWith(null, { message: 'storage unavailable' });
    expect((await requireSignedIn(client)).ok).toBe(false);
  });
});
