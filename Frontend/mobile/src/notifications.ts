import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  defaultNotificationPreferences,
  wantsNotification,
  type NotificationAccess,
  type NotificationKey,
  type NotificationPreferences,
} from '@snapworth/shared/features/profile';

const key = 'snapworth.notifications.v1';

// Something that arrives while the app is open is already on screen, so it shows as a quiet
// banner in the list rather than interrupting.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** The choices made on the Notifications screen, as last saved on this device. */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const stored = await AsyncStorage.getItem(key).catch(() => null);
  try {
    const saved = stored ? (JSON.parse(stored) as Partial<NotificationPreferences>) : {};
    return {
      paused: saved.paused === true,
      // New kinds of notification take their default until the person chooses.
      enabled: { ...defaultNotificationPreferences.enabled, ...saved.enabled },
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

async function readAccess(): Promise<NotificationAccess> {
  const { status, ios } = await Notifications.getPermissionsAsync();
  // A provisional (quiet) permission still delivers, to Notification Centre.
  if (status === 'granted' || ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }
  return status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * The Notifications screen's state: the saved choices, and whether iOS lets SnapWorth notify.
 * Coming back from Settings re-reads the permission, since that is where it gets changed.
 */
export function useNotificationSettings() {
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [access, setAccess] = useState<NotificationAccess>('granted');

  useEffect(() => {
    void loadNotificationPreferences().then(setPreferences);
    void readAccess().then(setAccess);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void readAccess().then(setAccess);
    });
    return () => subscription.remove();
  }, []);

  const change = useCallback((next: NotificationPreferences) => {
    setPreferences(next);
    void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const allow = useCallback(() => {
    void Notifications.requestPermissionsAsync()
      .then(() => readAccess())
      .then(setAccess)
      .catch(() => undefined);
  }, []);

  return {
    preferences,
    access,
    onChange: change,
    onAllow: allow,
    onOpenSettings: () => void Linking.openSettings(),
  };
}

export interface NotificationContent {
  readonly title: string;
  readonly body: string;
  /** Where tapping it leads. */
  readonly path: string;
}

/**
 * Lines up a notification for `inSeconds` from now, if the person asked to hear about this kind
 * and iOS allows it: the way to say something finished once the app has gone to the background,
 * where it stops running. Resolves with its id, to cancel it if they come back first.
 */
export async function scheduleNotification(
  kind: NotificationKey,
  content: NotificationContent,
  inSeconds: number,
): Promise<string | null> {
  const [preferences, access] = await Promise.all([loadNotificationPreferences(), readAccess()]);
  if (access !== 'granted' || !wantsNotification(preferences, kind)) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: { path: content.path } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(inSeconds)),
    },
  }).catch(() => null);
}

/** Withdraws a notification that has not been shown yet. */
export function cancelNotification(id: string | null): void {
  if (id) void Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

// The last notification already acted on, so a remount doesn't open it twice.
let handledResponse: string | null = null;

/**
 * Opens where a tapped notification leads, once the app is ready to navigate: on a tap while it
 * runs, or the tap that launched it.
 */
export function useOpenTappedNotifications(ready: boolean, open: (path: string) => void) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !response) return;
    const id = response.notification.request.identifier;
    if (id === handledResponse) return;
    handledResponse = id;
    const path: unknown = response.notification.request.content.data?.path;
    if (typeof path === 'string' && path.startsWith('/')) open(path);
  }, [open, ready, response]);
}
