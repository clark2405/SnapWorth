import { fetchUserProfile } from './userProfile';

// A stand-in Supabase whose profile row says what `profileRow` says. Counts are not under test.
let profileRow: Record<string, string | null> | null;
const counted = () => {
  const query = {
    eq: () => query,
    neq: () => query,
    or: () => query,
    then: (resolve: (value: { count: number }) => void) => resolve({ count: 0 }),
  };
  return query;
};
const client = {
  auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  from: () => ({
    select: (_columns: string, options?: { head?: boolean }) =>
      options?.head
        ? counted()
        : { eq: () => ({ maybeSingle: () => Promise.resolve({ data: profileRow }) }) },
  }),
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => client,
}));
// The session context renders React Native views; these tests call the profile functions directly.
jest.mock('../session', () => ({ useSession: jest.fn() }));

const account = {
  id: 'usr_1',
  email: 'pia@example.com',
  user_metadata: { full_name: 'Pia (account)', bio: 'Account bio', location: 'Account place' },
};

it('shows the name, bio and place the public profile holds, since that is what others see', async () => {
  profileRow = {
    handle: 'pia_thrifts',
    avatar_url: null,
    display_name: 'Pia Reyes',
    bio: 'Ukay finds',
    location: 'Cebu City',
  };
  const profile = await fetchUserProfile(account);

  expect(profile.displayName).toBe('Pia Reyes');
  expect(profile.bio).toBe('Ukay finds');
  expect(profile.location).toBe('Cebu City');
});

it('falls back to the account’s own copy where the public profile has nothing yet', async () => {
  profileRow = { handle: 'pia_thrifts', avatar_url: null, display_name: '', bio: '', location: '' };
  const profile = await fetchUserProfile(account);

  expect(profile.displayName).toBe('Pia (account)');
  expect(profile.bio).toBe('Account bio');
  expect(profile.location).toBe('Account place');
});
