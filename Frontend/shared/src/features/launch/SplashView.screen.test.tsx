import { act } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { SessionSplashView } from './SplashView';

let mockLoading = true;
jest.mock('../session', () => ({
  ...jest.requireActual<object>('../session'),
  useSession: () => ({ isLoading: mockLoading }),
}));

afterEach(() => jest.useRealTimers());

it('holds the launch screen until the saved session has been read, then lets it go', () => {
  jest.useFakeTimers();
  mockLoading = true;
  const onExit = jest.fn();
  const view = renderScreen(<SessionSplashView onExit={onExit} onDone={() => undefined} />);

  // Long past the splash's own hold: still up, because nobody knows yet who is signed in.
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(onExit).not.toHaveBeenCalled();

  mockLoading = false;
  view.rerender(<SessionSplashView onExit={onExit} onDone={() => undefined} />);
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(onExit).toHaveBeenCalledTimes(1);
});
