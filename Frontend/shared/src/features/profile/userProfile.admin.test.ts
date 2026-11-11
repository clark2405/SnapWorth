import { buildFallbackProfile, fetchUserProfile } from './userProfile';

// A stand-in Supabase whose `is_admin` answer each test sets.
let isAdminAnswer: { data: unknown; error: unknown } = { data: false, error: null };
const mockRpc = jest.fn(() => Promise.resolve(isAdminAnswer));
const mockClient = {
  auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  rpc: mockRpc,
  // The counts and the profile row aren't what's tested; each is tried and given up on.
  from: () => {
    throw new Error('no tables in this test');
  },
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => mockClient,
}));
// The session context renders React Native views; these tests call the profile functions directly.
jest.mock('../session', () => ({ useSession: jest.fn() }));

// Everything a person controls that might once have passed for an admin.
const pretender = {
  id: 'usr_pretend',
  email: 'bo@snapworth.com',
  user_metadata: { role: 'admin', is_admin: true },
  app_metadata: { role: 'admin' },
};

describe('who is an admin', () => {
  beforeEach(() => {
    mockRpc.mockClear();
    isAdminAnswer = { data: false, error: null };
  });

  it('is nobody, until the database says so', () => {
    expect(buildFallbackProfile(pretender).isAdmin).toBe(false);
    expect(buildFallbackProfile(null).isAdmin).toBe(false);
  });

  it('ignores metadata and a company email address', async () => {
    const profile = await fetchUserProfile(pretender);

    expect(mockRpc).toHaveBeenCalledWith('is_admin');
    expect(profile.isAdmin).toBe(false);
  });

  it('follows the database for a real admin, whatever their metadata', async () => {
    isAdminAnswer = { data: true, error: null };

    const profile = await fetchUserProfile({ id: 'usr_ada', email: 'ada@example.com' });

    expect(profile.isAdmin).toBe(true);
  });

  it('is not an admin when the database cannot be asked', async () => {
    isAdminAnswer = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };

    const profile = await fetchUserProfile({ id: 'usr_ada', email: 'ada@example.com' });

    expect(profile.isAdmin).toBe(false);
  });
});
