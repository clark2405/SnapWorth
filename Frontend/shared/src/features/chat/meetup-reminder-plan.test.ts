import type { ConfirmedMeetup } from '../../ports/chat';
import type { UtcDateTime } from '../../types/date-time';
import type { ConversationSummary } from '../../types/entities';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import {
  diffReminders,
  meetupWhenLabel,
  planMeetupReminders,
  reminderFingerprint,
  upcomingMeetups,
  type MeetupReminder,
} from './meetup-reminder-plan';

// Wednesday 11 November 2026, 9:30 AM on the device's own clock.
const now = new Date(2026, 10, 11, 9, 30);
const proposedAt = new Date(2026, 10, 11, 9, 0).toISOString() as UtcDateTime;

const conversation = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'lamp-chat' as ConversationId,
  listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
  other: { userId: 'test:bea' as UserId, handle: 'bea' },
  iAmSeller: true,
  latestActivityAt: proposedAt,
  unread: 0,
  blockedByMe: false,
  ...over,
});

const meetup = (over: Partial<ConfirmedMeetup> = {}): ConfirmedMeetup => ({
  messageId: 'm1' as MessageId,
  conversationId: 'lamp-chat' as ConversationId,
  place: 'SM Seaside',
  when: 'Today, 2:00 PM',
  purpose: 'pickup',
  proposedAt,
  ...over,
});

const upcoming = (meetups: readonly ConfirmedMeetup[], chats = [conversation()]) =>
  upcomingMeetups(meetups, chats, now);

describe('upcomingMeetups', () => {
  it('puts the time, place and who it is with together, soonest first', () => {
    const found = upcoming([
      meetup({ messageId: 'later' as MessageId, when: 'Saturday, 10:00 AM' }),
      meetup({ messageId: 'sooner' as MessageId }),
    ]);

    expect(found.map((entry) => entry.messageId)).toEqual(['sooner', 'later']);
    expect(found[0]).toMatchObject({
      conversationId: 'lamp-chat',
      place: 'SM Seaside',
      handle: 'bea',
      listingTitle: 'Brass lamp',
      startsAt: new Date(2026, 10, 11, 14, 0),
    });
  });

  it('leaves out a meetup whose time cannot be read', () => {
    expect(upcoming([meetup({ when: 'after lunch' })])).toEqual([]);
  });

  it('leaves out one that is long over, but keeps one just begun', () => {
    expect(upcoming([meetup({ when: 'Today, 8:00 AM' })])).toEqual([]);
    expect(upcoming([meetup({ when: 'Today, 9:15 AM' })])).toHaveLength(1);
  });

  it('leaves out chats that are over, blocked, or unknown', () => {
    expect(upcoming([meetup()], [conversation({ closed: 'sold' })])).toEqual([]);
    expect(upcoming([meetup()], [conversation({ blockedByMe: true })])).toEqual([]);
    expect(upcoming([meetup({ conversationId: 'other' as ConversationId })])).toEqual([]);
  });
});

describe('planMeetupReminders', () => {
  const plan = (when: string, at = now) => planMeetupReminders(upcoming([meetup({ when })]), at);

  it('reminds an hour before, and on the morning of a meetup later in the day', () => {
    const reminders = plan('Today, 2:00 PM', new Date(2026, 10, 11, 7, 0));

    expect(reminders.map((reminder) => [reminder.kind, reminder.fireAt])).toEqual([
      ['morning', new Date(2026, 10, 11, 8, 0)],
      ['hour', new Date(2026, 10, 11, 13, 0)],
    ]);
  });

  it('says what, who and where, and leads to the chat', () => {
    const [hour] = plan('Today, 2:00 PM');

    expect(hour).toMatchObject({
      id: 'meetup:m1:hour',
      title: 'Meetup in an hour',
      path: '/chat/lamp-chat',
      conversationId: 'lamp-chat',
    });
    expect(hour!.body).toMatch(/^Pickup · Brass lamp with @bea at SM Seaside, 2:00 pm$/i);
  });

  it('calls a viewing a viewing', () => {
    const [hour] = planMeetupReminders(upcoming([meetup({ purpose: 'viewing' })]), now);

    expect(hour!.body.startsWith('Viewing · ')).toBe(true);
  });

  it('skips the morning reminder when the morning has passed', () => {
    expect(plan('Today, 2:00 PM').map((reminder) => reminder.kind)).toEqual(['hour']);
  });

  it('skips the morning reminder for an early meetup, whose hour-before comes close behind', () => {
    const early = planMeetupReminders(upcoming([meetup({ when: 'Tomorrow, 10:00 AM' })]), now);

    expect(early.map((reminder) => reminder.kind)).toEqual(['hour']);
    expect(early[0]!.fireAt).toEqual(new Date(2026, 10, 12, 9, 0));
  });

  it('gives a meetup tomorrow afternoon both', () => {
    const reminders = plan('Tomorrow, 3:00 PM');

    expect(reminders.map((reminder) => [reminder.kind, reminder.fireAt])).toEqual([
      ['morning', new Date(2026, 10, 12, 8, 0)],
      ['hour', new Date(2026, 10, 12, 14, 0)],
    ]);
  });

  it('does not make up a reminder whose time has passed', () => {
    // 10:00 AM is half an hour away: its hour-before was 9:00.
    expect(plan('Today, 10:00 AM')).toEqual([]);
  });

  it('gives each meetup its own, by message id', () => {
    const reminders = planMeetupReminders(
      upcoming([
        meetup({ messageId: 'a' as MessageId, when: 'Tomorrow, 3:00 PM' }),
        meetup({ messageId: 'b' as MessageId, when: 'Saturday, 3:00 PM' }),
      ]),
      now,
    );

    expect(reminders.map((reminder) => reminder.id)).toEqual([
      'meetup:a:morning',
      'meetup:a:hour',
      'meetup:b:morning',
      'meetup:b:hour',
    ]);
  });

  it('plans nothing when there is no meetup', () => {
    expect(planMeetupReminders([], now)).toEqual([]);
  });
});

describe('diffReminders', () => {
  const reminder = (over: Partial<MeetupReminder> = {}): MeetupReminder => ({
    id: 'meetup:m1:hour',
    kind: 'hour',
    conversationId: 'lamp-chat',
    fireAt: new Date(2026, 10, 11, 13, 0),
    title: 'Meetup in an hour',
    body: 'Pickup · Brass lamp with @bea at SM Seaside, 2:00 pm',
    path: '/chat/lamp-chat',
    ...over,
  });
  const lined = (entry: MeetupReminder) => ({
    id: entry.id,
    fingerprint: reminderFingerprint(entry),
  });

  it('lines up what is new', () => {
    expect(diffReminders([], [reminder()])).toEqual({ cancel: [], schedule: [reminder()] });
  });

  it('does nothing when what is lined up is already right', () => {
    expect(diffReminders([lined(reminder())], [reminder()])).toEqual({ cancel: [], schedule: [] });
  });

  it('replaces a reminder whose meetup changed, under the same id', () => {
    const moved = reminder({ fireAt: new Date(2026, 10, 11, 15, 0), body: 'Pickup · … at Ayala' });

    expect(diffReminders([lined(reminder())], [moved])).toEqual({ cancel: [], schedule: [moved] });
  });

  it('withdraws reminders nothing plans any more', () => {
    const gone = reminder({ id: 'meetup:gone:hour' });

    expect(diffReminders([lined(gone), lined(reminder())], [reminder()])).toEqual({
      cancel: ['meetup:gone:hour'],
      schedule: [],
    });
  });

  it('withdraws everything when nothing is planned', () => {
    expect(diffReminders([lined(reminder())], [])).toEqual({
      cancel: ['meetup:m1:hour'],
      schedule: [],
    });
  });
});

describe('meetupWhenLabel', () => {
  it('counts down the last hour, and says Now once it has begun', () => {
    expect(meetupWhenLabel(new Date(2026, 10, 11, 10, 5), now)).toBe('In 35 min');
    expect(meetupWhenLabel(new Date(2026, 10, 11, 9, 30), now)).toBe('Now');
    expect(meetupWhenLabel(new Date(2026, 10, 11, 9, 15), now)).toBe('Now');
  });

  it('names the day, then the time', () => {
    expect(meetupWhenLabel(new Date(2026, 10, 11, 14, 0), now)).toMatch(/^Today, 2:00 pm$/i);
    expect(meetupWhenLabel(new Date(2026, 10, 12, 10, 0), now)).toMatch(/^Tomorrow, 10:00 am$/i);
    expect(meetupWhenLabel(new Date(2026, 10, 14, 18, 0), now)).toMatch(/^Sat, Nov 14, 6:00 pm$/i);
  });
});
