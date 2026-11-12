import { MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useBanner } from '../../components';
import type { ConfirmedMeetup } from '../../ports/chat';
import type { UtcDateTime } from '../../types/date-time';
import type { NotificationKey } from '../profile/NotificationsView';
import { useSession } from '../session';
import { useChatLive } from './chat-state';
import {
  diffReminders,
  planMeetupReminders,
  upcomingMeetups,
  type MeetupReminder,
  type ScheduledReminder,
  type UpcomingMeetup,
} from './meetup-reminder-plan';

/** How far back to look for agreed meetups: a day label reaches at most a week past its proposal. */
const lookbackMs = 8 * 86_400_000;

/**
 * Where reminders are lined up with the system. The phone's is local notifications; the web has
 * none (the browser can't wake a closed tab), so it shows its reminders in the app only.
 */
export interface ReminderScheduler {
  /** Whether SnapWorth may notify right now: the system's permission, and the person's choice. */
  allowed(): Promise<boolean>;
  /** The reminders already lined up (and only those), so a sync only changes what differs. */
  scheduled(): Promise<readonly ScheduledReminder[]>;
  /** Lines one up; one with the same id is replaced. */
  schedule(reminder: MeetupReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

export interface UpcomingMeetups {
  /** Soonest first; empty until the chats and their meetups have loaded. */
  readonly meetups: readonly UpcomingMeetup[];
  /** True once the meetups have loaded for whoever is signed in, so an empty list means none. */
  readonly loaded: boolean;
  /** The time this was worked out at, moving on every minute. */
  readonly now: Date;
  /** Moves on each time the meetups are loaded afresh, even if nothing in them changed. */
  readonly version: number;
}

/**
 * The agreed meetups still to come, kept current: loaded once the chats have, again when a chat
 * changes (a proposal confirmed, a chat closed) and when the app comes back to the front, and
 * dropped when the account changes.
 */
export function useUpcomingMeetups(): UpcomingMeetups {
  const { service, status, conversations, want } = useChatLive();
  const { status: session } = useSession();
  const signedIn = session === 'member';
  const [confirmed, setConfirmed] = useState<readonly ConfirmedMeetup[] | null>(null);
  const [reload, setReload] = useState(0);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (signedIn) want();
    else setConfirmed(null);
  }, [signedIn, want]);

  // The account's own meetups: someone else signing in starts again.
  useEffect(() => {
    if (!signedIn) return;
    return service.subscribe((event) => {
      if (event.type === 'account') setConfirmed(null);
    });
  }, [service, signedIn]);

  useEffect(() => {
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        setReload((count) => count + 1);
      }
    });
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      app.remove();
      clearInterval(tick);
    };
  }, []);

  const ready = signedIn && status === 'ready';
  useEffect(() => {
    if (!ready) return;
    let current = true;
    const since = new Date(Date.now() - lookbackMs).toISOString() as UtcDateTime;
    void service.confirmedMeetups(since).then((result) => {
      // A failed load keeps what is known: no news isn't a reason to take reminders down.
      if (!current || !result.ok) return;
      setConfirmed(result.value);
      setVersion((count) => count + 1);
    });
    return () => {
      current = false;
    };
  }, [conversations, ready, reload, service]);

  const meetups = useMemo(
    () => (ready && confirmed ? upcomingMeetups(confirmed, conversations, now) : []),
    [confirmed, conversations, now, ready],
  );
  return { meetups, loaded: ready && confirmed !== null, now, version };
}

export interface MeetupRemindersHostProps {
  /** Opens a conversation: the app shell owns navigation. */
  readonly onOpenConversation: (conversationId: string) => void;
  /** Whether the person wants meetup reminders; the shell reads their choices. */
  readonly wants?: (kind: Extract<NotificationKey, 'meetups'>) => boolean | Promise<boolean>;
  /** Lines reminders up with the system as well (the phone). Without it, they show in the app. */
  readonly scheduler?: ReminderScheduler;
}

/**
 * Reminds people of the meetups they've agreed to. Renders nothing. Every reminder comes twice
 * over: as a banner in the app when its time comes while the app is open, on the web and the
 * phone, and as a local notification the phone shows once the app is closed. The notifications
 * are kept in step with the meetups: a new or changed meetup lines up or replaces its reminders,
 * and one that's gone (the chat closed, the person blocked, signed out, or the time passed) takes
 * them down. Nothing is sent from a server, so no push service or paid account is involved.
 */
export function MeetupRemindersHost({
  onOpenConversation,
  wants,
  scheduler,
}: MeetupRemindersHostProps) {
  const { meetups, loaded, now, version } = useUpcomingMeetups();
  const { status: session } = useSession();
  const banner = useBanner();
  const signedIn = session === 'member';

  const reminders = useMemo(() => planMeetupReminders(meetups, now), [meetups, now]);
  // The same plan, as text: a minute passing doesn't change it, so timers aren't reset by it.
  const planKey = reminders.map((reminder) => `${reminder.id}@${reminder.fireAt.getTime()}`).join();
  const latest = useRef({ reminders, wants, onOpenConversation, banner });
  latest.current = { reminders, wants, onOpenConversation, banner };

  // In the app: a banner when each reminder's time comes.
  useEffect(() => {
    // Only what's still to come: one that just passed has been shown by its own timer.
    const coming = latest.current.reminders.filter(
      (reminder) => reminder.fireAt.getTime() > Date.now(),
    );
    const timers = coming.map((reminder) =>
      setTimeout(() => {
        void (async () => {
          const { wants: allowed, onOpenConversation: open, banner: show } = latest.current;
          if (allowed && !(await allowed('meetups'))) return;
          show.show({
            id: reminder.id,
            title: reminder.title,
            body: reminder.body,
            icon: MapPin,
            onPress: () => open(reminder.conversationId),
          });
        })();
      }, reminder.fireAt.getTime() - Date.now()),
    );
    return () => timers.forEach(clearTimeout);
  }, [planKey]);

  // On the phone: lined up with the system, and kept in step.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!scheduler) return;
    // Until this account's meetups are known, nothing is changed: not knowing isn't "none".
    // Signing out is the one time to take everything down, as it is known without them.
    const signedOut = wasSignedIn.current && !signedIn;
    wasSignedIn.current = signedIn;
    if (!signedOut && !(signedIn && loaded)) return;

    let current = true;
    void (async () => {
      const planned = signedOut || !(await scheduler.allowed()) ? [] : latest.current.reminders;
      const lined = await scheduler.scheduled();
      const { cancel, schedule } = diffReminders(lined, planned);
      if (!current) return;
      await Promise.all(cancel.map((id) => scheduler.cancel(id)));
      for (const reminder of schedule) {
        if (!current) return;
        await scheduler.schedule(reminder);
      }
    })().catch(() => undefined);
    return () => {
      current = false;
    };
  }, [loaded, planKey, scheduler, signedIn, version]);

  return null;
}
