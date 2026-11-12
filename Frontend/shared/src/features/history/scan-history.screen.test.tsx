import { act, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

import { renderScreen } from '../../testing/render-screen';
import { previewHistory } from '../preview/sample-data';
import { HistoryView } from './HistoryView';
import { saveScan, type KeyValueStore, type SavedScan } from './scan-history';
import { ScanHistoryProvider, useScanHistory } from './scan-history-state';

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

const scan = (id: string, title: string, estimate = 1000): SavedScan => ({
  id,
  title,
  estimate,
  lowPhp: estimate - 100,
  highPhp: estimate + 100,
  explanation: '',
  assumptions: [],
  photoUri: 'file:///photo.jpg',
  capturedOn: 'Nov 7, 2026',
  status: 'private',
});

/**
 * A stand-in Supabase with no reachable table (so each account's phone copy is what shows),
 * whose sign-ins the test controls.
 */
function fakeAuth(firstUser: string | null) {
  let listener: ((event: string, session: { user: { id: string } } | null) => void) | null = null;
  const sessionOf = (id: string | null) => (id ? { user: { id } } : null);
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sessionOf(firstUser) } }),
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: () => (listener = null) } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'offline' } }) }),
      }),
      insert: () => Promise.resolve({ error: { message: 'offline' } }),
    }),
  } as unknown as SupabaseClient;
  const signIn = (id: string | null) => listener?.(id ? 'SIGNED_IN' : 'SIGNED_OUT', sessionOf(id));
  return { client, signIn };
}

it('shows each account only its own scans, and nothing once signed out', async () => {
  const store = memoryStore();
  const { client, signIn } = fakeAuth('ana');
  await saveScan(scan('a1', 'Ana’s camera'), { store, client: null, owner: 'ana' });
  await saveScan(scan('b1', 'Ben’s jacket'), { store, client: null, owner: 'ben' });

  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <ScanHistoryProvider client={client} store={store}>
      {children}
    </ScanHistoryProvider>
  );
  const { result } = renderHook(() => useScanHistory(), { wrapper });
  await waitFor(() => expect(result.current.scans.map((item) => item.id)).toEqual(['a1']));

  act(() => signIn('ben'));
  // Ana's scans leave at once, then Ben's arrive.
  expect(result.current.scans).toEqual([]);
  await waitFor(() => expect(result.current.scans.map((item) => item.id)).toEqual(['b1']));

  act(() => signIn(null));
  expect(result.current.scans).toEqual([]);
  expect(await result.current.save(scan('x', 'Nobody’s'))).toBe('failed');
});

it('shows only real scans once there are any, with their own total', async () => {
  const store = memoryStore();
  await saveScan(scan('s1', 'Brass desk lamp', 1800), { store, client: null, owner: 'device' });

  renderScreen(
    <ScanHistoryProvider client={null} store={store}>
      <HistoryView />
    </ScanHistoryProvider>,
  );

  expect(await screen.findByText('Brass desk lamp')).toBeOnTheScreen();
  expect(screen.queryByText(previewHistory[0]!.title)).toBeNull();
  expect(screen.getByText('1 item')).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByText('₱1,800')).toBeOnTheScreen(), { timeout: 2000 });
  // Real scans have no price history yet, so the sample trend isn't shown.
  expect(screen.queryByText('+8.4% this month')).toBeNull();
});

it('shows the sample items as a preview before the first scan', async () => {
  renderScreen(
    <ScanHistoryProvider client={null} store={memoryStore()}>
      <HistoryView />
    </ScanHistoryProvider>,
  );
  expect(await screen.findByText(previewHistory[0]!.title)).toBeOnTheScreen();
  expect(screen.getByText('+8.4% this month')).toBeOnTheScreen();
});

it('puts a scan back, and says so, when it couldn’t be deleted', async () => {
  const store = memoryStore();
  // Supabase can't be reached for a delete: the stand-in has no delete at all.
  const { client } = fakeAuth('ana');
  await saveScan(scan('a1', 'Ana’s camera'), { store, client: null, owner: 'ana' });
  await saveScan(scan('a2', 'Ana’s lamp'), { store, client: null, owner: 'ana' });

  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <ScanHistoryProvider client={client} store={store}>
      {children}
    </ScanHistoryProvider>
  );
  const { result } = renderHook(() => useScanHistory(), { wrapper });
  await waitFor(() => expect(result.current.scans).toHaveLength(2));
  const before = result.current.scans.map((item) => item.id);

  let removed: boolean | undefined;
  await act(async () => {
    removed = await result.current.remove(before[0]!);
  });

  expect(removed).toBe(false);
  expect(result.current.scans.map((item) => item.id)).toEqual(before);
  // And it is still on the phone: a reload brings it back too.
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.scans.map((item) => item.id)).toEqual(before);
});
