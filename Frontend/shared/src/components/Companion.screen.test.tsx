import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../testing/render-screen';
import { Companion } from './Companion';

const mockHoldHandlers: Record<string, (...args: unknown[]) => void> = {};
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  function builder(hold = false) {
    const chain: object = new Proxy(
      {},
      {
        get:
          (_target, name: string) =>
          (...args: unknown[]) => {
            if (hold && name.startsWith('on')) {
              mockHoldHandlers[name] = args[0] as (...values: unknown[]) => void;
            }
            return chain;
          },
      },
    );
    return chain;
  }
  return {
    GestureDetector: View,
    Gesture: {
      Tap: () => builder(),
      Pan: () => builder(),
      LongPress: () => builder(true),
      Exclusive: () => builder(),
    },
  };
});

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('opens the camera only after a successful hold is released', () => {
  const onHoldSnap = jest.fn();
  renderScreen(
    <Companion actions={[]} greeting="Hello" onAsk={jest.fn()} onHoldSnap={onHoldSnap} />,
  );
  act(() => {
    mockHoldHandlers.onBegin?.();
    mockHoldHandlers.onStart?.();
    jest.advanceTimersByTime(1000);
  });
  expect(onHoldSnap).not.toHaveBeenCalled();
  act(() => {
    mockHoldHandlers.onEnd?.({}, true);
    mockHoldHandlers.onFinalize?.();
    jest.advanceTimersByTime(200);
  });
  expect(onHoldSnap).toHaveBeenCalledTimes(1);
});

it('ignores cancelled holds and repeated accessibility launches', () => {
  const onHoldSnap = jest.fn();
  renderScreen(
    <Companion actions={[]} greeting="Hello" onAsk={jest.fn()} onHoldSnap={onHoldSnap} />,
  );
  act(() => {
    mockHoldHandlers.onEnd?.({}, false);
    jest.advanceTimersByTime(200);
  });
  expect(onHoldSnap).not.toHaveBeenCalled();
  const orb = screen.getByRole('button', { name: 'Worthy, your pricing companion' });
  fireEvent(orb, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
  fireEvent(orb, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(onHoldSnap).toHaveBeenCalledTimes(1);
});

it('blocks hidden companion shortcuts and allows a new hold after returning', () => {
  const onHoldSnap = jest.fn();
  const props = { actions: [], greeting: 'Hello', onAsk: jest.fn(), onHoldSnap };
  const view = renderScreen(<Companion {...props} />);
  act(() => {
    mockHoldHandlers.onEnd?.({}, true);
  });
  expect(onHoldSnap).toHaveBeenCalledTimes(1);
  view.rerender(<Companion {...props} hidden />);
  act(() => {
    mockHoldHandlers.onEnd?.({}, true);
  });
  expect(onHoldSnap).toHaveBeenCalledTimes(1);
  view.rerender(<Companion {...props} />);
  act(() => {
    mockHoldHandlers.onEnd?.({}, true);
  });
  expect(onHoldSnap).toHaveBeenCalledTimes(2);
});

it('asks the host before opening, and opens only when told to', () => {
  let open: (() => void) | undefined;
  const onRequestOpen = jest.fn((next: () => void) => {
    open = next;
  });
  renderScreen(
    <Companion
      actions={[]}
      greeting="Hello from Worthy"
      onAsk={jest.fn()}
      onRequestOpen={onRequestOpen}
    />,
  );
  const orb = screen.getByRole('button', { name: 'Worthy, your pricing companion' });
  fireEvent(orb, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(onRequestOpen).toHaveBeenCalledTimes(1);
  // A guest's host shows the account sheet instead, so nothing opens.
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.queryByPlaceholderText('Ask Worthy anything…')).toBeNull();
  act(() => {
    open?.();
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByPlaceholderText('Ask Worthy anything…')).toBeTruthy();
});
