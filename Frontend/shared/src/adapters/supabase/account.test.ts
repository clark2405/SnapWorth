import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAccountObserver } from './account';

/** A stand-in Supabase whose first session and later sign-ins the test controls. */
function fakeAuth() {
  let first: (value: { data: { session: { user: { id: string } } | null } }) => void = () => {};
  let changed: ((event: string, session: { user: { id: string } } | null) => void) | null = null;
  const client = {
    auth: {
      getSession: () => new Promise((resolve) => (first = resolve)),
      onAuthStateChange: (callback: typeof changed) => {
        changed = callback;
        return { data: { subscription: { unsubscribe: () => (changed = null) } } };
      },
    },
  } as unknown as SupabaseClient;
  return {
    client,
    resolveFirst: (id: string | null) => first({ data: { session: id ? { user: { id } } : null } }),
    signIn: (id: string | null) =>
      changed?.(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null),
  };
}

it('follows the signed-in account through sign-ins and sign-outs', async () => {
  const auth = fakeAuth();
  const seen: (string | null)[] = [];
  const stop = createSupabaseAccountObserver(auth.client).observe((id) => seen.push(id));

  auth.resolveFirst('ana');
  await Promise.resolve();
  auth.signIn('ben');
  auth.signIn(null);
  expect(seen).toEqual(['ana', 'ben', null]);

  stop();
  auth.signIn('cara');
  expect(seen).toEqual(['ana', 'ben', null]);
});

it('never lets a slow first answer undo a sign-in that came after it', async () => {
  const auth = fakeAuth();
  const seen: (string | null)[] = [];
  createSupabaseAccountObserver(auth.client).observe((id) => seen.push(id));

  auth.signIn('ben');
  auth.resolveFirst(null);
  await Promise.resolve();
  expect(seen).toEqual(['ben']);
});
