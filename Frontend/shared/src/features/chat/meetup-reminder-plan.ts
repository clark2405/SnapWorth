import type { ConfirmedMeetup } from '../../ports/chat';
import type { ConversationSummary, MeetupPurpose } from '../../types/entities';
import { formatMessageTime } from './chat-format';
import { resolveMeetupStart } from './meetup-time';

/** How long before a meetup its heads-up comes: time enough to get there. */
export const hourBeforeMs = 60 * 60_000;
/** The hour of the day the morning-of reminder comes. */
export const morningHour = 8;
/**
 * The morning-of reminder is only for a meetup far enough into the day that the heads-up an hour
 * before wouldn't land right behind it: at least this long after the morning reminder.
 */
const morningGapMs = 3 * 60 * 60_000;
/** A meetup still counts as upcoming for this long after it starts, so it can be found at hand. */
export const underwayMs = 30 * 60_000;

/** A confirmed meetup, in time and place, with who it's with and what for. */
export interface UpcomingMeetup {
  readonly messageId: string;
  readonly conversationId: string;
  readonly place: string;
  readonly purpose: MeetupPurpose;
  readonly startsAt: Date;
  readonly handle: string;
  readonly listingTitle: string;
}

export type MeetupReminderKind = 'hour' | 'morning';

/** A heads-up to give at `fireAt`: as a local notification on the phone, a banner in the app. */
export interface MeetupReminder {
  /** Stable for a meetup and kind, so a changed reminder replaces the old one. */
  readonly id: string;
  readonly kind: MeetupReminderKind;
  readonly conversationId: string;
  readonly fireAt: Date;
  readonly title: string;
  readonly body: string;
  /** Where tapping it leads. */
  readonly path: string;
}

/** Ids of every reminder start with this, so they can be told from other notifications. */
export const reminderIdPrefix = 'meetup:';

/**
 * The agreed meetups still to come (or just begun), soonest first. A meetup whose time can't be
 * read is left out, and so is one in a chat that's over (the listing sold), a person the viewer
 * blocked, or one that isn't among `conversations`: an agreement nobody can keep gets no reminder.
 */
export function upcomingMeetups(
  meetups: readonly ConfirmedMeetup[],
  conversations: readonly ConversationSummary[],
  now: Date,
): UpcomingMeetup[] {
  const byId = new Map(
    conversations.map((conversation) => [conversation.id as string, conversation]),
  );
  const found: UpcomingMeetup[] = [];
  for (const meetup of meetups) {
    const conversation = byId.get(meetup.conversationId);
    if (!conversation || conversation.closed || conversation.blockedByMe) continue;
    const startsAt = resolveMeetupStart(meetup.when, meetup.proposedAt);
    if (!startsAt || startsAt.getTime() < now.getTime() - underwayMs) continue;
    found.push({
      messageId: meetup.messageId,
      conversationId: meetup.conversationId,
      place: meetup.place,
      purpose: meetup.purpose,
      startsAt,
      handle: conversation.other.handle,
      listingTitle: conversation.listing.title,
    });
  }
  return found.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

const dayFormatter = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * When a meetup is, as a list shows it: "Now" once it has begun, "In 35 min" within the hour,
 * then "Today, 2:00 pm", "Tomorrow, 10:00 am", or the day and date.
 */
export function meetupWhenLabel(startsAt: Date, now: Date): string {
  const minutes = Math.round((startsAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `In ${minutes} min`;
  const time = formatMessageTime(startsAt.toISOString());
  const days = Math.round((startOfDay(startsAt) - startOfDay(now)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${dayFormatter.format(startsAt)}, ${time}`;
}

function describe(meetup: UpcomingMeetup): string {
  const what = meetup.purpose === 'viewing' ? 'Viewing' : 'Pickup';
  const time = formatMessageTime(meetup.startsAt.toISOString());
  return `${what} · ${meetup.listingTitle} with @${meetup.handle} at ${meetup.place}, ${time}`;
}

/**
 * The reminders to line up for these meetups, from `now`:
 *  - an hour before, for every meetup: late enough to be the one that matters, early enough to
 *    travel (and to ask where they are), and
 *  - the morning of (8:00), for a meetup late enough in the day to be forgotten by then.
 * A reminder whose time has passed isn't made up late. Each is for one meetup (by its message
 * id), so a meetup that changes or goes away takes its reminders with it.
 */
export function planMeetupReminders(
  upcoming: readonly UpcomingMeetup[],
  now: Date,
): MeetupReminder[] {
  const reminders: MeetupReminder[] = [];
  for (const meetup of upcoming) {
    const body = describe(meetup);
    const path = `/chat/${meetup.conversationId}`;
    const base = { conversationId: meetup.conversationId, body, path };

    const morning = new Date(
      meetup.startsAt.getFullYear(),
      meetup.startsAt.getMonth(),
      meetup.startsAt.getDate(),
      morningHour,
    );
    if (
      meetup.startsAt.getTime() - morning.getTime() >= morningGapMs &&
      morning.getTime() > now.getTime()
    ) {
      reminders.push({
        ...base,
        id: `${reminderIdPrefix}${meetup.messageId}:morning`,
        kind: 'morning',
        fireAt: morning,
        title: 'Meetup today',
      });
    }

    const hourBefore = new Date(meetup.startsAt.getTime() - hourBeforeMs);
    if (hourBefore.getTime() > now.getTime()) {
      reminders.push({
        ...base,
        id: `${reminderIdPrefix}${meetup.messageId}:hour`,
        kind: 'hour',
        fireAt: hourBefore,
        title: 'Meetup in an hour',
      });
    }
  }
  return reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** What makes one reminder different from another with the same id: when, and what it says. */
export function reminderFingerprint(reminder: MeetupReminder): string {
  return [reminder.fireAt.getTime(), reminder.title, reminder.body, reminder.path].join('|');
}

/** A reminder already lined up with the system, by its id and what it says (`reminderFingerprint`). */
export interface ScheduledReminder {
  readonly id: string;
  readonly fingerprint: string;
}

/**
 * What to change to make `scheduled` match `planned`: withdraw reminders nothing plans any more
 * (the meetup was cancelled, the chat closed, or it's passed), and line up the new or changed
 * ones. A reminder already right is left alone, so syncing again and again does nothing.
 */
export function diffReminders(
  scheduled: readonly ScheduledReminder[],
  planned: readonly MeetupReminder[],
): { readonly cancel: readonly string[]; readonly schedule: readonly MeetupReminder[] } {
  const wanted = new Set(planned.map((reminder) => reminder.id));
  const have = new Map(scheduled.map((reminder) => [reminder.id, reminder.fingerprint]));
  return {
    cancel: scheduled.filter((reminder) => !wanted.has(reminder.id)).map((reminder) => reminder.id),
    schedule: planned.filter((reminder) => have.get(reminder.id) !== reminderFingerprint(reminder)),
  };
}
