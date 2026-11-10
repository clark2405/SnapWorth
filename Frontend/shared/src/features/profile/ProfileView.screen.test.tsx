import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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

describe('ProfileView: deleting the account', () => {
  const openSheet = () => {
    fireEvent.press(screen.getByText('Delete account'));
    return screen.getByLabelText('Type DELETE to confirm');
  };
  // The row that opens the sheet and the sheet's own button share a name; the sheet's is last.
  const confirm = () => screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!;

  it('deletes only once the confirmation word is typed', async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue({ kind: 'deleted' });
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    const field = openSheet();
    expect(confirm()).toBeDisabled();
    fireEvent.changeText(field, 'delet');
    expect(confirm()).toBeDisabled();

    fireEvent.changeText(field, 'delete');
    expect(confirm()).toBeEnabled();
    fireEvent.press(confirm());

    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledWith('delete'));
  });

  it('keeps the sheet open with the reason when the account could not be deleted', async () => {
    const onDeleteAccount = jest
      .fn()
      .mockResolvedValue({ kind: 'failed', message: 'Your account couldn’t be deleted.' });
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    fireEvent.changeText(openSheet(), 'DELETE');
    fireEvent.press(confirm());

    expect(await screen.findByText('Your account couldn’t be deleted.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeOnTheScreen();
  });

  it('keeps the account without asking anything else', () => {
    const onDeleteAccount = jest.fn();
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    fireEvent.changeText(openSheet(), 'DELETE');
    fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));

    expect(onDeleteAccount).not.toHaveBeenCalled();
  });
});
