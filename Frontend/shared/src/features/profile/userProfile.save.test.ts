import { updateUserProfile } from './userProfile';

// A stand-in Supabase client: the profile row's update answers with `profileReply` (or
// `photoReply` for the photo), uploads with `uploadReply`, and every call is recorded in order.
type Reply = { data: { id: string }[] | null; error: { code: string } | null };
let profileReply: Reply;
let photoReply: Reply;
let uploadReply: { error: { message: string } | null };
const calls: string[] = [];
const client = {
  storage: {
    from: (bucket: string) => ({
      upload: (path: string, _bytes: ArrayBuffer, options: { contentType: string }) => {
        calls.push(`storage ${bucket} upload ${path} ${options.contentType}`);
        return Promise.resolve(uploadReply);
      },
      remove: () => Promise.resolve({ error: null }),
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://project.test/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  },
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
          return Promise.resolve('avatar_url' in values ? photoReply : profileReply);
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
  photoReply = { data: [{ id: 'usr_1' }], error: null };
  uploadReply = { error: null };
  jest.spyOn(Date, 'now').mockReturnValue(1731240000000);
});

afterEach(() => jest.restoreAllMocks());

// A JPEG picked on the web arrives as a data URI; a phone's is a file, read the same way.
const pickedPhoto = 'data:image/jpeg;base64,/9j/4AAQ';
const uploadedPhoto =
  'https://project.test/storage/v1/object/public/avatars/usr_1/avatar.jpg?v=1731240000000';

const edit = {
  displayName: 'Pia',
  handle: 'pia_thrifts',
  location: 'Cebu City',
  bio: 'Ukay finds',
  avatarUrl: pickedPhoto,
};

it('saves the handle and the public details, uploads the new photo for everyone to see, then the account’s own copy', async () => {
  expect(await updateUserProfile(edit)).toEqual({ success: true });
  expect(calls).toEqual([
    'profiles usr_1 {"handle":"pia_thrifts"}',
    'profiles usr_1 {"display_name":"Pia","bio":"Ukay finds","location":"Cebu City"}',
    'storage avatars upload usr_1/avatar.jpg image/jpeg',
    `profiles usr_1 {"avatar_url":"${uploadedPhoto}"}`,
    `account {"full_name":"Pia","handle":"pia_thrifts","location":"Cebu City","bio":"Ukay finds","avatar_url":"${uploadedPhoto}"}`,
  ]);
});

it('says so when the photo can’t be uploaded, and saves nothing more', async () => {
  uploadReply = { error: { message: 'denied' } };
  expect(await updateUserProfile({ bio: 'New bio', avatarUrl: pickedPhoto })).toEqual({
    success: false,
    error: 'Your photo couldn’t be saved. Try again.',
  });
  expect(calls).toEqual([
    'profiles usr_1 {"bio":"New bio"}',
    'storage avatars upload usr_1/avatar.jpg image/jpeg',
  ]);
});

it('says so when the profile won’t take the photo, and saves nothing more', async () => {
  photoReply = { data: null, error: { code: '23514' } };
  expect(await updateUserProfile({ bio: 'New bio', avatarUrl: pickedPhoto })).toEqual({
    success: false,
    error: 'Your photo couldn’t be saved. Try again.',
  });
  expect(calls).toHaveLength(3);
});

it('keeps a photo that is already online as it is', async () => {
  const online = 'https://lh3.googleusercontent.com/a/photo';
  expect(await updateUserProfile({ avatarUrl: online })).toEqual({ success: true });
  expect(calls).toEqual([`account {"avatar_url":"${online}"}`]);
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

it('writes the name, bio and place to the public profile, and keeps the account in step', async () => {
  expect(
    await updateUserProfile({ displayName: 'Pia R.', bio: 'New bio', location: 'Mandaue' }),
  ).toEqual({ success: true });
  expect(calls).toEqual([
    'profiles usr_1 {"display_name":"Pia R.","bio":"New bio","location":"Mandaue"}',
    'account {"full_name":"Pia R.","location":"Mandaue","bio":"New bio"}',
  ]);
});

it('writes only what is being changed, and clears a bio when it is emptied', async () => {
  expect(await updateUserProfile({ bio: '' })).toEqual({ success: true });
  expect(calls).toEqual(['profiles usr_1 {"bio":""}', 'account {"bio":""}']);
});

it('says so when the profile won’t take the details, and changes nothing on the account', async () => {
  profileReply = { data: null, error: { code: '23514' } };
  expect(await updateUserProfile({ bio: 'x'.repeat(300) })).toEqual({
    success: false,
    error: 'Your profile details couldn’t be saved. Try again.',
  });
  expect(calls).toHaveLength(1);
});

it('says so when the database lets no row of the profile change', async () => {
  profileReply = { data: [], error: null };
  const result = await updateUserProfile({ displayName: 'Pia' });
  expect(result.success).toBe(false);
  expect(calls).toHaveLength(1);
});

it('saves nothing to the public profile when only the photo is already online', async () => {
  const online = 'https://lh3.googleusercontent.com/a/photo';
  await updateUserProfile({ avatarUrl: online });
  expect(calls.some((call) => call.startsWith('profiles'))).toBe(false);
});
