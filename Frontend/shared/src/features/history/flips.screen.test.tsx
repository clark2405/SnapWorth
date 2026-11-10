import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { HistoryView } from './HistoryView';
import { PaidPriceSection } from './PaidPriceSection';
import { PaidPricesProvider, type PaidPriceStore } from './paid-prices';
import { loadScans, saveScan, type SavedScan } from './scan-history';
import { ScanHistoryProvider } from './scan-history-state';

function memoryStore(
  saved?: Record<string, number>,
): PaidPriceStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (saved) data.set('snapworth.paid-prices.v1', JSON.stringify(saved));
  return {
    data,
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe('the flip tracker', () => {
  it('notes what was paid and shows how the flip went', async () => {
    const store = memoryStore();
    renderScreen(
      <PaidPricesProvider store={store}>
        <PaidPriceSection itemId="jacket" worth={2450} />
      </PaidPricesProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Add what you paid' }));
    fireEvent.changeText(screen.getByLabelText('What you paid, in pesos'), '150');
    expect(screen.getByText('Worth ₱2,300 more than you paid, at ₱2,450.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('+₱2,300 flip')).toBeOnTheScreen();
    expect(screen.getByText('16× what you paid')).toBeOnTheScreen();
    await waitFor(() =>
      expect(store.data.get('snapworth.paid-prices.v1')).toBe(JSON.stringify({ jacket: 150 })),
    );
  });

  it('forgets what was paid when it’s removed', async () => {
    renderScreen(
      <PaidPricesProvider store={memoryStore({ jacket: 150 })}>
        <PaidPriceSection itemId="jacket" worth={2450} />
      </PaidPricesProvider>,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove what you paid' }));

    expect(await screen.findByRole('button', { name: 'Add what you paid' })).toBeOnTheScreen();
  });

  it('won’t save something that isn’t a price', () => {
    renderScreen(<PaidPriceSection itemId="jacket" worth={2450} />);

    fireEvent.press(screen.getByRole('button', { name: 'Add what you paid' }));
    fireEvent.changeText(screen.getByLabelText('What you paid, in pesos'), 'cheap');

    expect(screen.getByText('Type the price in pesos, like 150.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows each flip in History, and the total on its card', async () => {
    renderScreen(
      <PaidPricesProvider store={memoryStore()} seed={{ 'nike-neon-windbreaker': 180 }}>
        <HistoryView />
      </PaidPricesProvider>,
    );

    expect(await screen.findByText('Paid ₱180 · +₱2,270')).toBeOnTheScreen();
    expect(screen.getByText('Paid ₱180 for 1 of these, now worth ₱2,450')).toBeOnTheScreen();
    expect(screen.getByText('+₱2,270 flip')).toBeOnTheScreen();
    // The card's total counts up for a moment; let it land.
    await waitFor(() => expect(screen.getByText('₱50,200')).toBeOnTheScreen(), { timeout: 2000 });
  });

  it('keeps what was paid for a saved scan on the scan itself, not with the samples', async () => {
    const store = memoryStore();
    const lamp: SavedScan = {
      id: '6f1c2a9e-4b7d-4c3e-9a1f-2d8e5b7c4a10',
      title: 'Brass desk lamp',
      estimate: 1800,
      lowPhp: 1500,
      highPhp: 2200,
      explanation: '',
      assumptions: [],
      photoUri: 'file:///lamp.jpg',
      capturedOn: 'Nov 7, 2026',
      status: 'private',
    };
    await saveScan(lamp, { store, client: null, owner: 'device' });
    renderScreen(
      <ScanHistoryProvider client={null} store={store}>
        <PaidPricesProvider store={store}>
          <PaidPriceSection itemId={lamp.id} worth={1800} />
        </PaidPricesProvider>
      </ScanHistoryProvider>,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Add what you paid' }));
    fireEvent.changeText(screen.getByLabelText('What you paid, in pesos'), '300');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('+₱1,500 flip')).toBeOnTheScreen();
    await waitFor(async () =>
      expect((await loadScans({ store, client: null, owner: 'device' }))[0]!.paidPhp).toBe(300),
    );
    expect(store.data.get('snapworth.paid-prices.v1')).toBeUndefined();
  });
});
