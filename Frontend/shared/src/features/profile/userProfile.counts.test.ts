import { fetchUserProfile } from './userProfile';

// A stand-in Supabase answering each count with how many rows the account has in that table.
const counts: Record<string, number> = {
  scan_history: 7,
  listings: 2,
  conversations: 3,
  votes: 5,
};
const filters: string[] = [];
const counted = (table: string) => {
  const query = {
    eq: (column: string, value: string) => {
      filters.push(`${table}.${column}=${value}`);
      return query;
    },
    neq: () => query,
    or: () => query,
    then: (resolve: (value: { count: number }) => void) => resolve({ count: counts[table]! }),
  };
  return query;
};
const client = {
  auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  from: (table: string) => ({
    select: (_columns: string, options?: { head?: boolean }) =>
      options?.head
        ? counted(table)
        : { eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) },
  }),
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => client,
}));
// The session context renders React Native views; these tests call the profile functions directly.
jest.mock('../session', () => ({ useSession: jest.fn() }));

it('counts what the account has checked from its own saved scans', async () => {
  const profile = await fetchUserProfile({ id: 'usr_1', email: 'pia@example.com' });

  expect(profile.stats.checked).toBe(7);
  expect(filters).toContain('scan_history.user_id=usr_1');
});

it('counts the account’s own votes, listings, sales and chats, never the sample figures', async () => {
  const profile = await fetchUserProfile({ id: 'usr_1', email: 'pia@example.com' });

  expect(profile.activity).toEqual({ listings: 2, votes: 5, conversations: 3 });
  expect(profile.stats).toEqual({ checked: 7, listed: 2, sold: 2 });
  expect(filters).toContain('votes.user_id=usr_1');
});

it('gives a real account no sample bio, place or rating', async () => {
  const profile = await fetchUserProfile({ id: 'usr_1', email: 'pia@example.com' });

  expect(profile.bio).toBe('');
  expect(profile.location).toBe('');
  expect(profile.rating).toBeNull();
});
