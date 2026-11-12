import * as Notifications from './local-notifications';
import { loadNotificationPreferences, readAccess } from './notifications';

import {
  reminderFingerprint,
  reminderIdPrefix,
  type ReminderScheduler,
} from '@snapworth/shared/features/chat';
import { wantsNotification } from '@snapworth/shared/features/profile';

/**
 * Meetup reminders as local notifications. They're scheduled on the phone for a time, so they
 * arrive with the app closed and need no server, no push service and no paid Apple account.
 * Each is identified by its meetup, so a changed one replaces the old, and what it says and when
 * is kept in its data so a later sync can tell a reminder that is right from one that isn't.
 */
export const meetupReminderScheduler: ReminderScheduler = {
  async allowed() {
    const [preferences, access] = await Promise.all([loadNotificationPreferences(), readAccess()]);
    return access === 'granted' && wantsNotification(preferences, 'meetups');
  },

  async scheduled() {
    const lined = await Notifications.getAllScheduledNotificationsAsync();
    return lined
      .filter((request) => request.identifier.startsWith(reminderIdPrefix))
      .map((request) => {
        const fingerprint: unknown = request.content.data?.fingerprint;
        return {
          id: request.identifier,
          fingerprint: typeof fingerprint === 'string' ? fingerprint : '',
        };
      });
  },

  async schedule(reminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { path: reminder.path, fingerprint: reminderFingerprint(reminder) },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt },
    });
  },

  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
};
