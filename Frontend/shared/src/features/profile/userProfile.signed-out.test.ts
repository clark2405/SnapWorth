import { fetchUserProfile } from './userProfile';

// A stand-in Supabase whose connection carries no sign-in yet (just after signing in or out),
// and which records anything the profile asks it.
const asked: string[] = [];
const client = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: null } }),
    getSession: () => Promise.resolve({ data: { session: null } }),
  },
  rpc: (name: string) => {
    asked.push(name);
    return Promise.resolve({ data: true, error: null });
  },
  from: (table: string) => {
    asked.push(table);
    throw new Error('asked as nobody');
  },
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => client,
}));
// The session context renders React Native views; these tests call the profile functions directly.
jest.mock('../session', () => ({ useSession: jest.fn() }));

it('asks nothing until the connection carries the sign-in, and calls the counts unknown, not 0', async () => {
  const profile = await fetchUserProfile({ id: 'usr_1', email: 'pia@example.com' });

  expect(asked).toEqual([]);
  expect(profile.stats).toEqual({ checked: null, listed: null, sold: null });
  expect(profile.activity).toEqual({ listings: null, votes: null, conversations: null });
  expect(profile.isAdmin).toBe(false);
});
