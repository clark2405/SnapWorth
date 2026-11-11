import { act, fireEvent, screen } from '@testing-library/react-native';

import { BannerProvider } from '../../components';
import type { ChatListener, ConfirmedMeetup } from '../../ports/chat';
import type { ChatService } from '../../ports/services';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { ConversationSummary } from '../../types/entities';
import type { AppError } from '../../types/errors';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import { err, ok } from '../../types/result';
import { ChatServiceProvider } from './chat-state';
import { reminderFingerprint, type ScheduledReminder } from './meetup-reminder-plan';
import { MeetupRemindersHost, type ReminderScheduler } from './meetup-reminders';

const mockSession = { status: 'member' as 'member' | 'guest' };
jest.mock('../session', () => ({
  ...jest.requireActual('../session'),
  useSession: () => mockSession,
}));

// Wednesday 11 November 2026, 9:30 AM on the device's own clock.
const now = new Date(2026, 10, 11, 9, 30);
const proposedAt = new Date(2026, 10, 11, 9, 0).toISOString() as UtcDateTime;

const chat = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'lamp-chat' as ConversationId,
  listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
  other: { userId: 'test:bea' as UserId, handle: 'bea' },
  iAmSeller: true,
  latestActivityAt: proposedAt,
  unread: 0,
  blockedByMe: false,
  ...over,
});

const agreed = (over: Partial<ConfirmedMeetup> = {}): ConfirmedMeetup => ({
  messageId: 'm1' as MessageId,
  conversationId: 'lamp-chat' as ConversationId,
  place: 'SM Seaside',
  when: 'Tomorrow, 3:00 PM',
  purpose: 'pickup',
  proposedAt,
  ...over,
});

/** A chat service with the chats and agreed meetups the test sets, and live changes it sends. */
function fakeChat() {
  const state = {
    conversations: [chat()] as ConversationSummary[],
    meetups: [agreed()] as ConfirmedMeetup[],
    meetupsError: null as AppError | null,
  };
  const listeners = new Set<ChatListener>();
  const service = {
    list: jest.fn(() => Promise.resolve(ok([...state.conversations]))),
    confirmedMeetups: jest.fn(() =>
      Promise.resolve(state.meetupsError ? err(state.meetupsError) : ok([...state.meetups])),
    ),
    subscribe: jest.fn((listener: ChatListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  } as unknown as ChatService;
  return {
    service,
    state,
    /** A change in the chats, as the service would announce it. */
    changed: () =>
      act(async () => {
        listeners.forEach((listener) =>
          listener({
            type: 'message',
            message: {
              id: 'x' as MessageId,
              conversationId: 'lamp-chat' as ConversationId,
              senderId: '' as UserId,
              mine: false,
              body: 'ok',
              createdAt: proposedAt,
              delivery: { status: 'sent' },
            },
          }),
        );
      }),
    switchAccount: (signedIn: boolean) =>
      act(async () => {
        listeners.forEach((listener) => listener({ type: 'account', signedIn }));
      }),
  };
}

/** A scheduler that remembers what is lined up, as the system does. */
function fakeScheduler(allowed = true) {
  const lined = new Map<string, ScheduledReminder & { fireAt: Date }>();
  const scheduler = {
    allowed: jest.fn(() => Promise.resolve(allowed)),
    scheduled: jest.fn(() => Promise.resolve([...lined.values()])),
    schedule: jest.fn((reminder) => {
      lined.set(reminder.id, {
        id: reminder.id,
        fingerprint: reminderFingerprint(reminder),
        fireAt: reminder.fireAt,
      });
      return Promise.resolve();
    }),
    cancel: jest.fn((id: string) => {
      lined.delete(id);
      return Promise.resolve();
    }),
  };
  return { scheduler: scheduler as ReminderScheduler & typeof scheduler, lined };
}

const flush = () => act(async () => undefined);

function show(
  service: ChatService,
  props: {
    readonly scheduler?: ReminderScheduler;
    readonly wants?: () => boolean | Promise<boolean>;
    readonly open?: (id: string) => void;
  } = {},
) {
  const tree = () => (
    <ChatServiceProvider service={service}>
      <BannerProvider>
        <MeetupRemindersHost
          onOpenConversation={props.open ?? jest.fn()}
          wants={props.wants}
          scheduler={props.scheduler}
        />
      </BannerProvider>
    </ChatServiceProvider>
  );
  const view = renderScreen(tree());
  // A fresh element, so what reads the (mocked) session renders again.
  return { ...view, again: () => view.rerender(tree()) };
}

beforeEach(() => {
  jest.useFakeTimers({ now });
  mockSession.status = 'member';
});
afterEach(() => jest.useRealTimers());

describe('on the phone: local notifications', () => {
  it('lines up an hour-before and a morning-of reminder once a meetup is agreed', async () => {
    const { service } = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(service, { scheduler });

    await flush();

    expect([...lined.keys()].sort()).toEqual(['meetup:m1:hour', 'meetup:m1:morning']);
    expect(scheduler.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'meetup:m1:morning',
        fireAt: new Date(2026, 10, 12, 8, 0),
        title: 'Meetup today',
        path: '/chat/lamp-chat',
      }),
    );
    expect(scheduler.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meetup:m1:hour', fireAt: new Date(2026, 10, 12, 14, 0) }),
    );
  });

  it('lines up nothing before the chats and meetups are known', async () => {
    const { service } = fakeChat();
    const { scheduler } = fakeScheduler();
    (service.list as jest.Mock).mockReturnValue(new Promise(() => undefined));
    show(service, { scheduler });

    await flush();

    expect(scheduler.scheduled).not.toHaveBeenCalled();
    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it('does not line up the same reminders again when nothing changed', async () => {
    const fake = fakeChat();
    const { scheduler } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();
    scheduler.schedule.mockClear();

    await fake.changed();
    await fake.changed();

    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it('replaces the reminders when the meetup changes', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();

    // The same agreement, now at another time and place.
    fake.state.meetups = [agreed({ when: 'Saturday, 4:00 PM', place: 'Ayala Center' })];
    await fake.changed();

    expect(lined.get('meetup:m1:hour')?.fireAt).toEqual(new Date(2026, 10, 14, 15, 0));
    expect(lined.get('meetup:m1:morning')?.fireAt).toEqual(new Date(2026, 10, 14, 8, 0));
    expect(lined.size).toBe(2);
  });

  it('takes the reminders down when the chat closes', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();
    expect(lined.size).toBe(2);

    fake.state.conversations = [chat({ closed: 'sold' })];
    await fake.changed();

    expect(scheduler.cancel).toHaveBeenCalledWith('meetup:m1:hour');
    expect(scheduler.cancel).toHaveBeenCalledWith('meetup:m1:morning');
    expect(lined.size).toBe(0);
  });

  it('takes the reminders down when the person is blocked', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();

    fake.state.conversations = [chat({ blockedByMe: true })];
    await fake.changed();

    expect(lined.size).toBe(0);
  });

  it('adds the reminders of a second meetup without touching the first', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();
    scheduler.cancel.mockClear();

    fake.state.meetups = [
      agreed(),
      agreed({ messageId: 'm2' as MessageId, when: 'Saturday, 10:00 AM' }),
    ];
    await fake.changed();

    expect([...lined.keys()].sort()).toEqual([
      'meetup:m1:hour',
      'meetup:m1:morning',
      'meetup:m2:hour',
    ]);
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it('takes everything down when the person signs out', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    const view = show(fake.service, { scheduler });
    await flush();
    expect(lined.size).toBe(2);

    mockSession.status = 'guest';
    view.again();
    await flush();

    expect(lined.size).toBe(0);
  });

  it('takes the old account’s reminders down when someone else signs in', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();
    expect(lined.size).toBe(2);

    // The new account has no meetups.
    fake.state.meetups = [];
    fake.state.conversations = [];
    await fake.switchAccount(true);
    await flush();

    expect(lined.size).toBe(0);
  });

  it('does nothing for a guest who never signed in', async () => {
    mockSession.status = 'guest';
    const { service } = fakeChat();
    const { scheduler } = fakeScheduler();
    show(service, { scheduler });

    await flush();

    expect(scheduler.scheduled).not.toHaveBeenCalled();
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it('lines up nothing, and withdraws what was, when notifications are not allowed', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler(false);
    lined.set('meetup:m1:hour', { id: 'meetup:m1:hour', fingerprint: 'old', fireAt: now });
    show(fake.service, { scheduler });

    await flush();

    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(lined.size).toBe(0);
  });

  it('keeps the reminders it has when the meetups cannot be loaded', async () => {
    const fake = fakeChat();
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });
    await flush();
    expect(lined.size).toBe(2);

    fake.state.meetupsError = { kind: 'offline', operation: 'load_messages', retryable: true };
    await fake.changed();

    expect(lined.size).toBe(2);
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it('does not make up a reminder that is already late', async () => {
    const fake = fakeChat();
    fake.state.meetups = [agreed({ when: 'Today, 10:00 AM' })];
    const { scheduler, lined } = fakeScheduler();
    show(fake.service, { scheduler });

    await flush();

    // Its hour-before was 9:00, and it's 9:30. The morning has passed too.
    expect(lined.size).toBe(0);
  });
});

describe('in the app, on the web and the phone', () => {
  const heardOn = async (when: string) => {
    const fake = fakeChat();
    fake.state.meetups = [agreed({ when })];
    return fake;
  };

  it('shows a banner an hour before', async () => {
    const fake = await heardOn('Today, 2:00 PM');
    show(fake.service);
    await flush();
    expect(screen.queryByText('Meetup in an hour')).toBeNull();

    // 1:00 PM: 3.5 hours on.
    await act(async () => {
      jest.advanceTimersByTime(3.5 * 3_600_000);
    });

    expect(await screen.findByText('Meetup in an hour')).toBeOnTheScreen();
    expect(screen.getByText(/Pickup · Brass lamp with @bea at SM Seaside/)).toBeOnTheScreen();
  });

  it('opens the chat when the banner is tapped', async () => {
    const fake = await heardOn('Today, 2:00 PM');
    const open = jest.fn();
    show(fake.service, { open });
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(3.5 * 3_600_000);
    });

    fireEvent.press(await screen.findByRole('button', { name: /Meetup in an hour/ }));

    expect(open).toHaveBeenCalledWith('lamp-chat');
  });

  it('shows the morning one, too, for a meetup tomorrow afternoon', async () => {
    const fake = fakeChat();
    show(fake.service);
    await flush();

    // 8:00 AM tomorrow: 22.5 hours on.
    await act(async () => {
      jest.advanceTimersByTime(22.5 * 3_600_000);
    });

    expect(await screen.findByText('Meetup today')).toBeOnTheScreen();
  });

  it('stays quiet when the person turned meetup reminders off', async () => {
    const fake = await heardOn('Today, 2:00 PM');
    show(fake.service, { wants: () => false });
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(3.5 * 3_600_000);
    });

    expect(screen.queryByText('Meetup in an hour')).toBeNull();
  });

  it('shows nothing for a meetup in a chat that has closed', async () => {
    const fake = await heardOn('Today, 2:00 PM');
    fake.state.conversations = [chat({ closed: 'sold' })];
    show(fake.service);
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(3.5 * 3_600_000);
    });

    expect(screen.queryByText('Meetup in an hour')).toBeNull();
  });
});
