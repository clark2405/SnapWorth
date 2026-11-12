import { screen } from '@testing-library/react-native';

import { createLocalAdminRepository } from '../../adapters';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import { AdminProvider } from '../admin/admin-state';
import { ProfileView } from './ProfileView';

// Signed in to a Supabase that says whether the account is an admin, and nothing else.
let mockIsAdmin = false;
const session = {
  user: {
    id: 'usr_1',
    email: 'pia@snapworth.com',
    user_metadata: { role: 'admin', is_admin: true },
    app_metadata: { role: 'admin' },
  },
};
const nothing = {
  eq: () => nothing,
  or: () => nothing,
  maybeSingle: () => Promise.resolve({ data: null }),
  then: (resolve: (value: { count: null }) => void) => resolve({ count: null }),
};
const mockClient = {
  auth: {
    getSession: () => Promise.resolve({ data: { session } }),
    getUser: () => Promise.resolve({ data: { user: session.user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  },
  rpc: () => Promise.resolve({ data: mockIsAdmin, error: null }),
  from: () => ({ select: () => nothing }),
};
jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => mockClient,
}));

const waiting = createLocalAdminRepository({
  seed: ['a', 'b'].map((id) => ({
    id: `hanap:${id}`,
    kind: 'hanap' as const,
    targetId: id,
    status: 'held' as const,
    body: 'Looking for a thing',
    authorHandle: 'bo',
    authorAvatarUrl: null,
    flagRef: null,
    reportCount: 0,
    reportReasons: [],
    flaggedAt: '2026-11-11T09:00:00.000Z' as UtcDateTime,
    context: null,
    title: null,
    photoUrl: null,
  })),
});

const profile = () =>
  renderScreen(
    <AdminProvider repository={waiting}>
      <ProfileView />
    </AdminProvider>,
  );

it('offers the review queue to an admin the database vouches for, with how many wait', async () => {
  mockIsAdmin = true;
  profile();

  expect(await screen.findByText('Moderation')).toBeOnTheScreen();
  expect(await screen.findByText('2')).toBeOnTheScreen();
});

it('hides it from an account whose metadata and email claim to be admin', async () => {
  mockIsAdmin = false;
  profile();

  expect(await screen.findByText('Notifications')).toBeOnTheScreen();
  expect(screen.queryByText('Moderation')).toBeNull();
});
