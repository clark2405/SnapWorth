import { screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { saveScan, type KeyValueStore, type SavedScan } from '../history/scan-history';
import { ScanHistoryProvider } from '../history/scan-history-state';
import { ProfileView } from './ProfileView';

// Signed in to a Supabase that has nothing else to say about the account.
const session = { user: { id: 'usr_1', email: 'pia@example.com', user_metadata: {} } };
const nothing = {
  eq: () => nothing,
  or: () => nothing,
  maybeSingle: () => Promise.resolve({ data: null }),
  then: (resolve: (value: { count: null }) => void) => resolve({ count: null }),
};
const client = {
  auth: {
    getSession: () => Promise.resolve({ data: { session } }),
    getUser: () => Promise.resolve({ data: { user: session.user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  },
  from: () => ({ select: () => nothing }),
};
jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => client,
}));

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const scan = (id: string): SavedScan => ({
  id,
  title: 'Thing',
  estimate: 100,
  lowPhp: 80,
  highPhp: 120,
  explanation: '',
  assumptions: [],
  photoUri: '',
  capturedOn: 'Nov 7, 2026',
  status: 'private',
});

it('counts what the account has checked from its own saved scans', async () => {
  const store = memoryStore();
  for (const id of ['a', 'b', 'c'])
    await saveScan(scan(id), { store, client: null, owner: 'device' });

  renderScreen(
    <ScanHistoryProvider client={null} store={store}>
      <ProfileView />
    </ScanHistoryProvider>,
  );

  expect(await screen.findByLabelText('3 checked')).toBeOnTheScreen();
});
