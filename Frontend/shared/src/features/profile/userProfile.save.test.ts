import { updateUserProfile } from './userProfile';

// A stand-in Supabase client: the profile row's update answers with `profileReply`, and every
// call is recorded in order.
let profileReply: { data: { id: string }[] | null; error: { code: string } | null };
const calls: string[] = [];
const client = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: 'usr_1' } } }),
    updateUser: (attributes: { data: Record<string, unknown> }) => {
      calls.push(`account ${JSON.stringify(attributes.data)}`);
      return Promise.resolve({ error: null });
    },
  },
  from: (table: string) => ({
    update: (values: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => ({
        select: () => {
          calls.push(`${table} ${id} ${JSON.stringify(values)}`);
          return Promise.resolve(profileReply);
        },
      }),
    }),
  }),
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => client,
}));
// The session context renders React Native views; these tests call the profile functions directly.
jest.mock('../session', () => ({ useSession: jest.fn() }));

beforeEach(() => {
  calls.length = 0;
  profileReply = { data: [{ id: 'usr_1' }], error: null };
});

const edit = {
  displayName: 'Pia',
  handle: 'pia_thrifts',
  location: 'Cebu City',
  bio: 'Ukay finds',
  avatarUrl: 'file:///photo.jpg',
};

it('saves the handle to the public profile, then the rest to the account', async () => {
  expect(await updateUserProfile(edit)).toEqual({ success: true });
  expect(calls).toEqual([
    'profiles usr_1 {"handle":"pia_thrifts"}',
    'account {"full_name":"Pia","handle":"pia_thrifts","location":"Cebu City","bio":"Ukay finds","avatar_url":"file:///photo.jpg"}',
  ]);
});

it('says so when the handle is taken, and saves nothing else', async () => {
  profileReply = { data: null, error: { code: '23505' } };
  expect(await updateUserProfile(edit)).toEqual({
    success: false,
    error: 'That handle is taken. Try another.',
  });
  expect(calls).toHaveLength(1);
});

it('says so when the database let nothing change', async () => {
  profileReply = { data: [], error: null };
  const result = await updateUserProfile(edit);
  expect(result.success).toBe(false);
  expect(calls).toHaveLength(1);
});

it('leaves the public profile alone when the handle isn’t being changed', async () => {
  expect(await updateUserProfile({ bio: 'New bio' })).toEqual({ success: true });
  expect(calls).toEqual(['account {"bio":"New bio"}']);
});
