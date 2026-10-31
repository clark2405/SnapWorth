import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { PaidPricesProvider } from './paid-prices';
import { ShareTagSheet, type ShareableItem } from './ShareTagSheet';

const mockShareCardImage = jest.fn((_card: unknown, _text: string) => Promise.resolve('opened'));
jest.mock('./share-image', () => ({
  shareCardImage: (card: unknown, text: string) => mockShareCardImage(card, text),
}));

const jacket: ShareableItem = {
  id: 'jacket',
  title: 'Vintage Nike Neon Windbreaker',
  photo: { uri: 'https://example.test/jacket.jpg' },
  photoLabel: 'Teal windbreaker',
  worth: 2450,
};

const store = (saved: Record<string, number>) => ({
  getItem: () => Promise.resolve(JSON.stringify(saved)),
  setItem: () => Promise.resolve(),
});

beforeEach(() => mockShareCardImage.mockClear());

it('shows the tag as it will be shared, and shares it', async () => {
  const onClose = jest.fn();
  renderScreen(<ShareTagSheet item={jacket} onClose={onClose} />);

  expect(screen.getByText('Vintage Nike Neon Windbreaker')).toBeOnTheScreen();
  expect(screen.getByText('₱2,450')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(mockShareCardImage).toHaveBeenCalledWith(
    expect.anything(),
    'Vintage Nike Neon Windbreaker: worth about ₱2,450 on SnapWorth.',
  );
});

it('keeps what was paid off the picture unless it’s switched on', async () => {
  renderScreen(
    <PaidPricesProvider store={store({ jacket: 180 })}>
      <ShareTagSheet item={jacket} onClose={() => undefined} />
    </PaidPricesProvider>,
  );

  const toggle = await screen.findByLabelText('Show what I paid on the picture');
  expect(screen.queryByText('Paid ₱180 · +₱2,270')).toBeNull();
  fireEvent(toggle, 'valueChange', true);
  expect(screen.getByText('Paid ₱180 · +₱2,270')).toBeOnTheScreen();
});

it('offers no such switch when nothing was paid', () => {
  renderScreen(<ShareTagSheet item={jacket} onClose={() => undefined} />);

  expect(screen.queryByLabelText('Show what I paid on the picture')).toBeNull();
});
