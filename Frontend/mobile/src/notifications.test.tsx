import type * as NotificationSettings from './notifications';

const mockSetHandler = jest.fn();
const mockSchedule = jest.fn().mockResolvedValue('local-notification-1');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockReadPermissions = jest.fn().mockResolvedValue({ status: 'granted' });

// SDK 57's package entry loads push registration and throws on Android Expo Go.
// Local notification use must never evaluate it.
jest.mock('expo-notifications', () => {
  throw new Error('Android push notifications are unavailable in Expo Go');
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@snapworth/shared/features/profile', () => ({
  defaultNotificationPreferences: { paused: false, enabled: { estimates: true } },
  wantsNotification: (preferences: { paused: boolean }, kind: string) =>
    !preferences.paused && kind === 'estimates',
}));
jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: mockSetHandler,
}));
jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: mockReadPermissions,
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/NotificationPermissions.types', () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('expo-notifications/build/Notifications.types', () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: mockSchedule,
}));
jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: mockCancel,
}));
jest.mock('expo-notifications/build/useLastNotificationResponse', () => ({
  useLastNotificationResponse: jest.fn().mockReturnValue(null),
}));

function loadSettings() {
  return jest.requireActual<typeof NotificationSettings>('./notifications');
}

it('loads settings and the notification handler without importing Android push registration', () => {
  expect(() => loadSettings()).not.toThrow();
  expect(mockSetHandler).toHaveBeenCalledWith({ handleNotification: expect.any(Function) });
});

it('can still schedule and cancel a local estimate notification', async () => {
  const settings = loadSettings();
  const id = await settings.scheduleNotification(
    'estimates',
    { title: 'Ready', body: 'Your estimate is ready', path: '/history' },
    0,
  );
  expect(id).toBe('local-notification-1');
  expect(mockSchedule).toHaveBeenCalledWith({
    content: { title: 'Ready', body: 'Your estimate is ready', data: { path: '/history' } },
    trigger: { type: 'timeInterval', seconds: 1 },
  });
  settings.cancelNotification(id);
  expect(mockCancel).toHaveBeenCalledWith(id);
});
