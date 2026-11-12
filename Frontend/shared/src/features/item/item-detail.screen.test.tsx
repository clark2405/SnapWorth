import { fireEvent, screen } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

import { renderScreen } from '../../testing/render-screen';
import { saveScan, type KeyValueStore, type SavedScan } from '../history/scan-history';
import { ScanHistoryProvider } from '../history/scan-history-state';
import { EstimateResultView } from './EstimateResultView';

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

const lamp: SavedScan = {
  id: '6f1c2a9e-4b7d-4c3e-9a1f-2d8e5b7c4a10',
  title: 'Brass desk lamp',
  estimate: 1800,
  lowPhp: 1500,
  highPhp: 2200,
  explanation: 'Solid brass with its original shade; lamps like it sell steadily.',
  assumptions: ['The wiring works.', 'No dents on the base.'],
  photoUri: 'file:///lamp.jpg',
  capturedOn: 'Nov 7, 2026',
  status: 'private',
};

async function withScans(scans: readonly SavedScan[]) {
  const store = memoryStore();
  for (const scan of scans) await saveScan(scan, { store, client: null, owner: 'device' });
  return ({ children }: { readonly children: ReactNode }) => (
    <ScanHistoryProvider client={null} store={store}>
      {children}
    </ScanHistoryProvider>
  );
}

it('shows a saved scan: its estimate, range, reasoning, photo and date', async () => {
  const Scans = await withScans([lamp]);
  renderScreen(
    <Scans>
      <EstimateResultView itemId={lamp.id} />
    </Scans>,
  );

  expect(await screen.findByText('Why this price')).toBeOnTheScreen();
  expect(screen.getAllByText('Brass desk lamp').length).toBeGreaterThan(0);
  expect(screen.getByText('₱1,800')).toBeOnTheScreen();
  expect(screen.getByText(lamp.explanation)).toBeOnTheScreen();
  expect(screen.getByText('• The wiring works.')).toBeOnTheScreen();
  expect(screen.getByText('Snapped Nov 7, 2026')).toBeOnTheScreen();
  expect(screen.getByLabelText('Brass desk lamp')).toBeOnTheScreen();
  expect(screen.getByText('Private')).toBeOnTheScreen();
  // The sample's market detail isn't made up for a real scan.
  expect(screen.queryByText('Recent sales')).toBeNull();
  expect(screen.queryByText('Condition')).toBeNull();
  expect(screen.queryByText('Vintage Nike Neon Windbreaker')).toBeNull();
});

it('shows where a scan lives once it’s listed', async () => {
  const Scans = await withScans([{ ...lamp, status: 'listed' }]);
  renderScreen(
    <Scans>
      <EstimateResultView itemId={lamp.id} />
    </Scans>,
  );

  expect(await screen.findByText('Listed')).toBeOnTheScreen();
  expect(screen.queryByText('Private')).toBeNull();
});

it('offers "Ready to sell?" only for an item that is still just a scan', async () => {
  const Scans = await withScans([lamp, { ...lamp, id: 'listed-lamp', status: 'listed' }]);
  const { unmount } = renderScreen(
    <Scans>
      <EstimateResultView itemId={lamp.id} />
    </Scans>,
  );
  expect(await screen.findByText('Ready to sell?')).toBeOnTheScreen();
  unmount();

  renderScreen(
    <Scans>
      <EstimateResultView itemId="listed-lamp" />
    </Scans>,
  );
  expect(await screen.findByText('Listed')).toBeOnTheScreen();
  expect(screen.queryByText('Ready to sell?')).toBeNull();
});

it('does not say a photo was saved for a scan that has none', async () => {
  const Scans = await withScans([
    { ...lamp, photoUri: '' },
    { ...lamp, id: 'with-photo' },
  ]);
  const { unmount } = renderScreen(
    <Scans>
      <EstimateResultView itemId={lamp.id} />
    </Scans>,
  );
  expect(await screen.findByText('Saved to your history')).toBeOnTheScreen();
  expect(screen.queryByText('Photo saved to your history')).toBeNull();
  unmount();

  renderScreen(
    <Scans>
      <EstimateResultView itemId="with-photo" />
    </Scans>,
  );
  expect(await screen.findByText('Photo saved to your history')).toBeOnTheScreen();
});

it('says so when the item isn’t in History, and offers the way back', async () => {
  const onBack = jest.fn();
  const Scans = await withScans([lamp]);
  renderScreen(
    <Scans>
      <EstimateResultView itemId="0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d" onBack={onBack} />
    </Scans>,
  );

  expect(await screen.findByText('This item isn’t in your History')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Back to History' }));
  expect(onBack).toHaveBeenCalled();
});

it('waits for the scans to load before saying an item is missing', () => {
  // Signed in, but the account isn't known yet: the scans are still loading.
  const client = {
    auth: {
      getSession: () => new Promise(() => undefined),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  } as unknown as SupabaseClient;
  renderScreen(
    <ScanHistoryProvider client={client} store={memoryStore()}>
      <EstimateResultView itemId="0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d" />
    </ScanHistoryProvider>,
  );

  expect(screen.queryByText('This item isn’t in your History')).toBeNull();
});

it('still opens the sample items before the first scan', async () => {
  const Scans = await withScans([]);
  renderScreen(
    <Scans>
      <EstimateResultView itemId="polaroid-sun-600" />
    </Scans>,
  );

  expect(await screen.findByText('Recent sales')).toBeOnTheScreen();
  expect(screen.getByText('On feed')).toBeOnTheScreen();
});
