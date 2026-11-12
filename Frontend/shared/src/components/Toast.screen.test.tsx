import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { Button } from 'react-native';

import { renderScreen } from '../testing/render-screen';
import { useToast, type ToastMessage } from './Toast';

function Caller({ message }: { readonly message: ToastMessage }) {
  const toast = useToast();
  return <Button title="Go" onPress={() => toast.show(message)} />;
}

const show = (message: ToastMessage) => {
  renderScreen(<Caller message={message} />);
  fireEvent.press(screen.getByText('Go'));
};

describe('Toast', () => {
  afterEach(() => {
    jest.clearAllMocks();
    act(() => jest.runOnlyPendingTimers());
  });

  beforeEach(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  it('confirms a success politely, with a success haptic', () => {
    show({ title: 'Saved' });

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(
      screen.UNSAFE_getByProps({ accessibilityRole: 'alert' }).props.accessibilityLiveRegion,
    ).toBe('polite');
    expect(screen.UNSAFE_queryByType(CircleCheck)).toBeTruthy();
    expect(screen.UNSAFE_queryByType(CircleAlert)).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('reports a failure firmly, with a warning haptic instead of a success one', () => {
    show({ title: 'Sign-in failed', body: 'Wrong password.', tone: 'error' });

    expect(screen.getByText('Sign-in failed')).toBeOnTheScreen();
    expect(
      screen.UNSAFE_getByProps({ accessibilityRole: 'alert' }).props.accessibilityLiveRegion,
    ).toBe('assertive');
    expect(screen.UNSAFE_queryByType(CircleAlert)).toBeTruthy();
    expect(screen.UNSAFE_queryByType(CircleCheck)).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(Haptics.notificationAsync).not.toHaveBeenCalledWith('success');
  });
});
