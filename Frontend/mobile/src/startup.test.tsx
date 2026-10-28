import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import RootRoute from '../app/index';
import OnboardingRoute from '../app/onboarding';
import TabsLayout from '../app/(tabs)/_layout';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockIsGuest = true;
let mockReplay: string | undefined;
let mockCanGoBack = false;

jest.mock('expo/virtual/env', () => ({ env: process.env }));

const mockCloseIntoTag = jest.fn(() => Promise.resolve());
const mockOpenFromTag = jest.fn();
jest.mock('@snapworth/shared/components', () => ({
  closeIntoTag: (...args: unknown[]) => mockCloseIntoTag(...(args as [])),
  openFromTag: () => mockOpenFromTag(),
}));

jest.mock('expo-router/unstable-native-tabs', () => {
  const { Text } = jest.requireActual<typeof ReactNative>('react-native');
  const NativeTabs = () => <Text>App tabs</Text>;
  const Trigger = () => null;
  Trigger.Icon = () => null;
  Trigger.Label = () => null;
  Trigger.Badge = () => null;
  NativeTabs.Trigger = Trigger;
  NativeTabs.BottomAccessory = () => null;
  return { NativeTabs };
});

jest.mock('@snapworth/shared/design', () => ({
  fontFaces: { '500': 'test-font' },
  useTheme: () => ({ colors: { accent: '#000' } }),
}));

jest.mock('./SnapAccessory', () => ({ SnapAccessory: () => null, SnapBar: () => null }));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof ReactNative>('react-native');
    return <Text>{href}</Text>;
  },
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => mockCanGoBack }),
  useLocalSearchParams: () => ({ replay: mockReplay }),
}));

jest.mock('@snapworth/shared/features/session', () => ({
  useSession: () => ({
    status: mockIsGuest ? 'guest' : 'member',
    isGuest: mockIsGuest,
    startSession: jest.fn(),
    endSession: jest.fn(),
    createAccount: jest.fn(),
    signIn: jest.fn(),
  }),
}));

jest.mock('@snapworth/shared/features/onboarding', () => ({
  OnboardingView: ({ onGetStarted, onSkip, onSignIn }: Record<string, () => void>) => {
    const { Button, View } = jest.requireActual<typeof ReactNative>('react-native');
    return (
      <View>
        <Button title="Get started" onPress={onGetStarted} />
        <Button title="Skip" onPress={onSkip} />
        {onSignIn ? <Button title="Sign in" onPress={onSignIn} /> : null}
      </View>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest = true;
  mockReplay = undefined;
  mockCanGoBack = false;
  delete process.env.EXPO_PUBLIC_DEV_START_ROUTE;
});

it('opens onboarding on every signed-out launch', () => {
  render(<RootRoute />);
  expect(screen.getByText('/onboarding')).toBeTruthy();
});

it('opens the feed for an existing in-memory session', () => {
  mockIsGuest = false;
  render(<RootRoute />);
  expect(screen.getByText('/feed')).toBeTruthy();
});

it('lets a guest look around, through the tag hand-off, when onboarding is skipped', async () => {
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText('Skip'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/feed'));
  expect(mockCloseIntoTag).toHaveBeenCalledWith(expect.objectContaining({ eyebrow: 'Guest pass' }));
  expect(mockOpenFromTag).toHaveBeenCalledTimes(1);
});

it.each([
  ['Get started', '/signup'],
  ['Sign in', '/login'],
])('preserves onboarding %s navigation', (button, route) => {
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText(button));
  expect(mockReplace).toHaveBeenCalledWith(route);
});

it('returns to settings when replaying onboarding', () => {
  mockReplay = '1';
  mockCanGoBack = true;
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText('Skip'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('lets a guest browse the app tabs', () => {
  render(<TabsLayout />);
  expect(screen.getByText('App tabs')).toBeTruthy();
  expect(screen.queryByText('/login')).toBeNull();
});

it('keeps app tabs available to a signed-in session', () => {
  mockIsGuest = false;
  render(<TabsLayout />);
  expect(screen.getByText('App tabs')).toBeTruthy();
});

it('allows explicit development route previews without a session', () => {
  process.env.EXPO_PUBLIC_DEV_START_ROUTE = '/feed';
  render(<TabsLayout />);
  expect(screen.getByText('App tabs')).toBeTruthy();
});
