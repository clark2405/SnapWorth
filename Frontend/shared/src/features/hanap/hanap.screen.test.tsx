import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createLocalHanapRepository, screenWithRules } from '../../adapters';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { UserId } from '../../types/ids';
import { HanapProvider } from './hanap-state';
import { HanapView } from './HanapView';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const at = (minutesAgo: number) =>
  new Date(Date.UTC(2026, 9, 30, 10, 0) - minutesAgo * 60_000).toISOString() as UtcDateTime;

const repository = () =>
  createLocalHanapRepository({
    store: memoryStore(),
    viewer: { userId: 'test:me' as UserId, handle: 'me' },
    screen: screenWithRules,
    seed: [
      {
        id: 'mine',
        authorHandle: 'me',
        body: 'Nike windbreaker',
        maxPhp: 3000,
        createdAt: at(30),
        mine: true,
      },
      { id: 'theirs', authorHandle: 'juan', body: 'Film camera', maxPhp: 4000, createdAt: at(10) },
    ],
  });

it('keeps someone else’s post theirs, and screens new ones', async () => {
  const hanap = repository();
  expect((await hanap.remove('theirs')).ok).toBe(false);
  const held = await hanap.post({ body: 'Walkman, text me 09171234567', maxPhp: null });
  expect(held.ok && held.value.moderation).toBe('held');
  const tooShort = await hanap.post({ body: ' a ', maxPhp: null });
  expect(tooShort.ok).toBe(false);
});

it('shows your hanap with the listings that match, and what others want', async () => {
  renderScreen(
    <HanapProvider repository={repository()}>
      <HanapView />
    </HanapProvider>,
  );

  expect(await screen.findByText('Nike windbreaker')).toBeOnTheScreen();
  // The Market's Retro Nike Teal Windbreaker asks ₱2,600, under the ₱3,000 budget.
  expect(screen.getByText('1 match')).toBeOnTheScreen();
  expect(screen.getByText('Retro Nike Teal Windbreaker')).toBeOnTheScreen();
  expect(screen.getByText('Film camera')).toBeOnTheScreen();
});

it('closes a hanap once it’s found', async () => {
  renderScreen(
    <HanapProvider repository={repository()}>
      <HanapView />
    </HanapProvider>,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Found it' }));

  expect(await screen.findByText('Found')).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText('1 match')).toBeNull());
});
