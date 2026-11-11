import type * as Scheduler from './meetup-reminders';

const mockGetAll = jest.fn();
const mockSchedule = jest.fn().mockResolvedValue('meetup:m1:hour');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockAccess = jest.fn();
const mockPreferences = jest.fn();

jest.mock('./local-notifications', () => ({
  getAllScheduledNotificationsAsync: mockGetAll,
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('./notifications', () => ({
  readAccess: mockAccess,
  loadNotificationPreferences: mockPreferences,
}));
jest.mock('@snapworth/shared/features/chat', () => ({
  reminderIdPrefix: 'meetup:',
  reminderFingerprint: (reminder: { id: string }) => `fingerprint of ${reminder.id}`,
}));
jest.mock('@snapworth/shared/features/profile', () => ({
  wantsNotification: (
    preferences: { paused: boolean; enabled: Record<string, boolean> },
    key: string,
  ) => !preferences.paused && preferences.enabled[key],
}));

const { meetupReminderScheduler: scheduler } =
  jest.requireActual<typeof Scheduler>('./meetup-reminders');

const reminder = {
  id: 'meetup:m1:hour',
  kind: 'hour' as const,
  conversationId: 'lamp-chat',
  fireAt: new Date(2026, 10, 11, 13, 0),
  title: 'Meetup in an hour',
  body: 'Pickup · Brass lamp with @bea at SM Seaside, 2:00 pm',
  path: '/chat/lamp-chat',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess.mockResolvedValue('granted');
  mockPreferences.mockResolvedValue({ paused: false, enabled: { meetups: true } });
});

describe('the meetup reminder scheduler', () => {
  it('lines a reminder up for its time, under its own id, leading to the chat', async () => {
    await scheduler.schedule(reminder);

    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: 'meetup:m1:hour',
      content: {
        title: 'Meetup in an hour',
        body: reminder.body,
        data: { path: '/chat/lamp-chat', fingerprint: 'fingerprint of meetup:m1:hour' },
      },
      trigger: { type: 'date', date: reminder.fireAt },
    });
  });

  it('lists only the meetup reminders already lined up, with their fingerprints', async () => {
    mockGetAll.mockResolvedValue([
      { identifier: 'meetup:m1:hour', content: { data: { fingerprint: 'abc' } } },
      { identifier: 'meetup:m2:morning', content: { data: {} } },
      // The estimate notification isn't ours to touch.
      { identifier: 'a-uuid', content: { data: { path: '/history' } } },
    ]);

    expect(await scheduler.scheduled()).toEqual([
      { id: 'meetup:m1:hour', fingerprint: 'abc' },
      { id: 'meetup:m2:morning', fingerprint: '' },
    ]);
  });

  it('withdraws one by id', async () => {
    await scheduler.cancel('meetup:m1:hour');

    expect(mockCancel).toHaveBeenCalledWith('meetup:m1:hour');
  });

  it('is allowed once iOS permits notifications and the person wants meetup reminders', async () => {
    expect(await scheduler.allowed()).toBe(true);
  });

  it('is not allowed without the system’s permission', async () => {
    mockAccess.mockResolvedValue('denied');
    expect(await scheduler.allowed()).toBe(false);

    mockAccess.mockResolvedValue('undetermined');
    expect(await scheduler.allowed()).toBe(false);
  });

  it('is not allowed when the person turned meetup reminders off, or paused everything', async () => {
    mockPreferences.mockResolvedValue({ paused: false, enabled: { meetups: false } });
    expect(await scheduler.allowed()).toBe(false);

    mockPreferences.mockResolvedValue({ paused: true, enabled: { meetups: true } });
    expect(await scheduler.allowed()).toBe(false);
  });
});
