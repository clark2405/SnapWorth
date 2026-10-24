import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import RootRoute from '../app/index';
import OnboardingRoute from '../app/onboarding';
import TabsLayout from '../app/(tabs)/_layout';
import { hasSeenIntro, markIntroSeen } from './intro-store';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockIsGuest = true;
let mockReplay: string | undefined;
let mockCanGoBack = false;

jest.mock('expo/virtual/env', () => ({ env: process.env }));

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

jest.mock('./intro-store', () => ({
  hasSeenIntro: jest.fn(),
  markIntroSeen: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest = true;
  mockReplay = undefined;
  mockCanGoBack = false;
  jest.mocked(hasSeenIntro).mockResolvedValue(true);
  jest.mocked(markIntroSeen).mockResolvedValue();
  delete process.env.EXPO_PUBLIC_DEV_START_ROUTE;
});

it('requires login when a returning viewer has no session', async () => {
  render(<RootRoute />);
  await waitFor(() => expect(screen.getByText('/login')).toBeTruthy());
});

it('opens the feed for an existing in-memory session', async () => {
  mockIsGuest = false;
  render(<RootRoute />);
  await waitFor(() => expect(screen.getByText('/feed')).toBeTruthy());
});

it('shows onboarding on the first launch', async () => {
  jest.mocked(hasSeenIntro).mockResolvedValue(false);
  render(<RootRoute />);
  await waitFor(() => expect(screen.getByText('/onboarding')).toBeTruthy());
});

it('records skipped onboarding and requires login', () => {
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText('Skip'));
  expect(markIntroSeen).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

it.each([
  ['Get started', '/signup'],
  ['Sign in', '/login'],
])('preserves onboarding %s navigation', (button, route) => {
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText(button));
  expect(markIntroSeen).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(route);
});

it('returns to settings when replaying onboarding', () => {
  mockReplay = '1';
  mockCanGoBack = true;
  render(<OnboardingRoute />);
  fireEvent.press(screen.getByText('Skip'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(markIntroSeen).not.toHaveBeenCalled();
});

it('requires login when a guest navigates directly to app tabs', () => {
  render(<TabsLayout />);
  expect(screen.getByText('/login')).toBeTruthy();
  expect(screen.queryByText('App tabs')).toBeNull();
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
