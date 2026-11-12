import { fetchUserProfile, updateUserProfile } from './userProfile';

// A stand-in Supabase whose head-count queries answer from `answers`, and that records how many
// times each table was counted.
type Answer = { count: number | null; error?: { message: string } } | 'reject';
let answers: Record<string, Answer>;
const asked: string[] = [];
const counted = (table: string) => {
  const query = {
    eq: () => query,
    neq: () => query,
    or: () => query,
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
      asked.push(table);
      const answer = answers[table]!;
      if (answer === 'reject') reject(new Error('offline'));
      else resolve({ error: null, ...answer });
    },
  };
  return query;
};
const client = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: null } }),
    updateUser: () => Promise.resolve({ error: null }),
  },
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

const account = { id: 'usr_1', email: 'pia@example.com' };

beforeEach(() => {
  asked.length = 0;
  answers = {
    scan_history: { count: 7 },
    listings: { count: 2 },
    conversations: { count: 3 },
    votes: { count: 5 },
  };
});

it('shows a count that failed as unknown, not as zero, and keeps the ones that loaded', async () => {
  answers.scan_history = { count: null, error: { message: 'permission denied' } };
  answers.conversations = 'reject';

  const profile = await fetchUserProfile(account);

  expect(profile.stats.checked).toBeNull();
  expect(profile.activity.conversations).toBeNull();
  expect(profile.activity.votes).toBe(5);
  expect(profile.stats.listed).toBe(2);
});

it('still shows a real zero as zero', async () => {
  answers.votes = { count: 0 };
  answers.conversations = { count: 0 };
  const profile = await fetchUserProfile(account);
  expect(profile.activity.votes).toBe(0);
  expect(profile.activity.conversations).toBe(0);
});

it('asks the database once when several parts of a screen ask for the profile together', async () => {
  const [first, second, third, fourth] = await Promise.all([
    fetchUserProfile(account),
    fetchUserProfile(account),
    fetchUserProfile(account),
    fetchUserProfile(account),
  ]);

  expect(asked.filter((table) => table === 'scan_history')).toHaveLength(1);
  expect(asked.filter((table) => table === 'votes')).toHaveLength(1);
  expect(first).toBe(second);
  expect(third).toBe(fourth);
});

it('loads again for the next request, so a later change is seen', async () => {
  await fetchUserProfile(account);
  answers.votes = { count: 6 };
  const again = await fetchUserProfile(account);
  expect(again.activity.votes).toBe(6);
});

it('does not share a load between two accounts', async () => {
  await Promise.all([fetchUserProfile(account), fetchUserProfile({ id: 'usr_2', email: 'b@c.d' })]);
  expect(asked.filter((table) => table === 'scan_history')).toHaveLength(2);
});

it('does not hand back a load that began before a save', async () => {
  const before = fetchUserProfile(account);
  await updateUserProfile({ bio: 'New bio' });
  answers.votes = { count: 9 };
  const after = await fetchUserProfile(account);
  await before;
  expect(after.activity.votes).toBe(9);
});
