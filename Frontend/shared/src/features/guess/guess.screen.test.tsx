import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import type { DeviceStore } from '../history/device-store';
import { dailyItems, dayKey } from './guess-game';
import { GuessProvider } from './guess-state';
import { GuessView } from './GuessView';

function memoryStore(): DeviceStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const morning = () => new Date(2026, 10, 4, 9, 0);
const items = dailyItems(dayKey(morning()));

async function guess(title: string, amount: number) {
  fireEvent.changeText(
    await screen.findByLabelText(`Your guess for ${title}, in pesos`),
    String(amount),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Guess' }));
}

it('plays a day: guess, see the worth, and finish with a score', async () => {
  renderScreen(
    <GuessProvider store={memoryStore()}>
      <GuessView now={morning} />
    </GuessProvider>,
  );

  for (const [index, item] of items.entries()) {
    expect(await screen.findByText(item.title)).toBeOnTheScreen();
    await guess(item.title, item.worth);
    expect(await screen.findByText('SnapWorth says')).toBeOnTheScreen();
    expect(screen.getByText('+100')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', {
        name: index === items.length - 1 ? 'See your score' : 'Next item',
      }),
    );
  }

  expect(await screen.findByLabelText('500 out of 500')).toBeOnTheScreen();
  expect(screen.getByText('Sharp eye')).toBeOnTheScreen();
  expect(screen.getByText('1-day streak')).toBeOnTheScreen();
});

it('picks up where it was left, and doesn’t let a thing be guessed twice', async () => {
  const store = memoryStore();
  const first = items[0]!;
  const { unmount } = renderScreen(
    <GuessProvider store={store}>
      <GuessView now={morning} />
    </GuessProvider>,
  );
  await guess(first.title, first.worth * 2);
  expect(await screen.findByText('+0')).toBeOnTheScreen();
  unmount();

  renderScreen(
    <GuessProvider store={store}>
      <GuessView now={morning} />
    </GuessProvider>,
  );
  // Back on the second thing: the first one's answer was already seen.
  expect(await screen.findByText(items[1]!.title)).toBeOnTheScreen();
  expect(screen.getByLabelText('Item 2 of 5')).toBeOnTheScreen();
});
