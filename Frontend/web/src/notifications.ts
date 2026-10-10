import { useCallback, useEffect, useState } from 'react';

import {
  defaultNotificationPreferences,
  wantsNotification,
  type NotificationAccess,
  type NotificationKey,
  type NotificationPreferences,
} from '@snapworth/shared/features/profile';

const key = 'snapworth.notifications.v1';

/** The choices made on the Notifications screen, as last saved in this browser. */
export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    const saved = stored ? (JSON.parse(stored) as Partial<NotificationPreferences>) : {};
    return {
      paused: saved.paused === true,
      enabled: { ...defaultNotificationPreferences.enabled, ...saved.enabled },
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

function readAccess(): NotificationAccess {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.permission === 'denied' ? 'denied' : 'undetermined';
}

/**
 * The Notifications screen's state in a browser: the saved choices, and whether the site may
 * notify. A refused permission can only be changed in the browser's own site settings, so there
 * is no settings link to offer.
 */
export function useNotificationSettings() {
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [access, setAccess] = useState<NotificationAccess>('granted');

  useEffect(() => {
    setPreferences(loadNotificationPreferences());
    setAccess(readAccess());
  }, []);

  const change = useCallback((next: NotificationPreferences) => {
    setPreferences(next);
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(next));
    } catch {
      // Blocked storage keeps the choices for this visit only.
    }
  }, []);

  const allow = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then(() => setAccess(readAccess()));
  }, []);

  return { preferences, access, onChange: change, onAllow: allow };
}

/**
 * Tells the person something finished while they were on another tab, if they asked to hear
 * about it and the browser allows it. Clicking it brings this tab back and opens `path`.
 */
export function notify(
  kind: NotificationKey,
  content: { readonly title: string; readonly body: string; readonly path: string },
  open: (path: string) => void,
): void {
  if (typeof document === 'undefined' || !document.hidden) return;
  if (readAccess() !== 'granted' || !wantsNotification(loadNotificationPreferences(), kind)) return;
  const notification = new Notification(content.title, { body: content.body });
  notification.onclick = () => {
    window.focus();
    open(content.path);
    notification.close();
  };
}
