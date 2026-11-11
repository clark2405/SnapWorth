import { act, fireEvent, screen } from '@testing-library/react-native';

import type { ChatListener, ConfirmedMeetup } from '../../ports/chat';
import type { ChatService } from '../../ports/services';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { ConversationSummary } from '../../types/entities';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import { ok } from '../../types/result';
import { ChatServiceProvider } from './chat-state';
import { UpcomingMeetups } from './UpcomingMeetups';

const mockSession = { status: 'member' as 'member' | 'guest' };
jest.mock('../session', () => ({
  ...jest.requireActual('../session'),
  useSession: () => mockSession,
}));

// Wednesday 11 November 2026, 9:30 AM on the device's own clock.
const now = new Date(2026, 10, 11, 9, 30);
const proposedAt = new Date(2026, 10, 11, 9, 0).toISOString() as UtcDateTime;

const chat = (id: string, over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: id as ConversationId,
  listing: { key: id, title: `Item ${id}`, askingPricePhp: 1500 },
  other: { userId: `test:${id}` as UserId, handle: `person_${id}` },
  iAmSeller: true,
  latestActivityAt: proposedAt,
  unread: 0,
  blockedByMe: false,
  ...over,
});

const agreed = (conversation: string, when: string, place = 'SM Seaside'): ConfirmedMeetup => ({
  messageId: `m-${conversation}` as MessageId,
  conversationId: conversation as ConversationId,
  place,
  when,
  purpose: 'pickup',
  proposedAt,
});

function show(conversations: ConversationSummary[], meetups: ConfirmedMeetup[], open = jest.fn()) {
  const service = {
    list: jest.fn(() => Promise.resolve(ok([...conversations]))),
    confirmedMeetups: jest.fn(() => Promise.resolve(ok([...meetups]))),
    subscribe: jest.fn((_listener: ChatListener) => () => undefined),
  } as unknown as ChatService;
  renderScreen(
    <ChatServiceProvider service={service}>
      <UpcomingMeetups onOpenConversation={open} />
    </ChatServiceProvider>,
  );
  return { open };
}

beforeEach(() => {
  jest.useFakeTimers({ now });
  mockSession.status = 'member';
});
afterEach(() => jest.useRealTimers());

it('lists the agreed meetups soonest first, with when, what and with whom', async () => {
  show(
    [chat('a'), chat('b')],
    [agreed('a', 'Saturday, 6:00 PM', 'Ayala Center'), agreed('b', 'Today, 2:00 PM')],
  );

  expect(await screen.findByText('Upcoming meetups')).toBeOnTheScreen();
  const times = screen.getAllByText(/, \d+:\d\d (am|pm)$/i).map((node) => node.props.children);
  expect(times).toEqual([
    expect.stringMatching(/^Today, 2:00 pm$/i),
    expect.stringMatching(/^Sat, Nov 14/i),
  ]);
  expect(screen.getByText('Pickup · Item b with @person_b at SM Seaside')).toBeOnTheScreen();
  expect(screen.getByText('Pickup · Item a with @person_a at Ayala Center')).toBeOnTheScreen();
});

it('opens the chat when a meetup is tapped', async () => {
  const { open } = show([chat('a')], [agreed('a', 'Tomorrow, 10:00 AM')]);

  fireEvent.press(await screen.findByRole('button', { name: /Pickup of Item a with person_a/ }));

  expect(open).toHaveBeenCalledWith('a');
});

it('counts down a meetup that is close', async () => {
  show([chat('a')], [agreed('a', 'Today, 10:15 AM')]);

  expect(await screen.findByText('In 45 min')).toBeOnTheScreen();
});

it('shows nothing when there are no meetups, or only ones in chats that are over', async () => {
  show([chat('a', { closed: 'sold' })], [agreed('a', 'Today, 2:00 PM')]);
  await act(async () => undefined);

  expect(screen.queryByText('Upcoming meetups')).toBeNull();
});

it('shows nothing to a guest', async () => {
  mockSession.status = 'guest';
  show([chat('a')], [agreed('a', 'Today, 2:00 PM')]);
  await act(async () => undefined);

  expect(screen.queryByText('Upcoming meetups')).toBeNull();
});
