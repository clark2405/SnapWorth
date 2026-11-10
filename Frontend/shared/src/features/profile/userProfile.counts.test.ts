import { fetchUserProfile } from './userProfile';

// A stand-in Supabase answering each count with how many rows the account has in that table.
const counts: Record<string, number> = { scan_history: 7, listings: 2, conversations: 3 };
const filters: string[] = [];
const counted = (table: string) => {
  const query = {
    eq: (column: string, value: string) => {
      filters.push(`${table}.${column}=${value}`);
      return query;
    },
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
