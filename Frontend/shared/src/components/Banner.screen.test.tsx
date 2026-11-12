import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../testing/render-screen';
import { BannerProvider, useBanner, type BannerMessage } from './Banner';

let api: ReturnType<typeof useBanner>;
function Capture() {
  api = useBanner();
  return null;
}

const show = (message: BannerMessage) => act(() => api.show(message));

beforeEach(() => {
  jest.useFakeTimers();
  renderScreen(
    <BannerProvider>
      <Capture />
    </BannerProvider>,
  );
});
afterEach(() => jest.useRealTimers());

it('shows a banner and runs what it leads to when it is tapped, then goes', () => {
  const onPress = jest.fn();
  show({ id: 'a', title: '@bea', body: 'Hello', onPress });

  fireEvent.press(screen.getByRole('button', { name: '@bea. Hello' }));

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Hello')).toBeNull();
});

it('lifts away on its own after a few seconds', () => {
  show({ id: 'a', title: '@bea', body: 'Hello' });
  expect(screen.getByText('Hello')).toBeOnTheScreen();

  act(() => jest.advanceTimersByTime(6100));

  expect(screen.queryByText('Hello')).toBeNull();
});

it('shows one at a time: a newer banner replaces the one on screen', () => {
  show({ id: 'a', title: '@bea', body: 'First' });
  show({ id: 'b', title: '@sam', body: 'Second' });

  expect(screen.queryByText('First')).toBeNull();
  expect(screen.getByText('Second')).toBeOnTheScreen();
});

it('can be taken down by id, and only that one', () => {
  show({ id: 'a', title: '@bea', body: 'First' });

  act(() => api.dismiss('other'));
  expect(screen.getByText('First')).toBeOnTheScreen();

  act(() => api.dismiss('a'));
  expect(screen.queryByText('First')).toBeNull();
});
