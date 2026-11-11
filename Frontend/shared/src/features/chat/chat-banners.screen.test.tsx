import { act, fireEvent, screen } from '@testing-library/react-native';

import { BannerProvider } from '../../components';
import type { ChatListener } from '../../ports/chat';
import type { ChatService } from '../../ports/services';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { ConversationDetail, ConversationSummary, Message } from '../../types/entities';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import { ok } from '../../types/result';
import { chatBannerFor, ChatBannerHost } from './chat-banners';
import { ChatServiceProvider, useConversation } from './chat-state';

const mockSession = { status: 'member' as 'member' | 'guest' };
jest.mock('../session', () => ({
  ...jest.requireActual('../session'),
  useSession: () => mockSession,
}));

const summary = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'lamp-chat' as ConversationId,
  listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
  other: { userId: 'test:bea' as UserId, handle: 'bea' },
  iAmSeller: true,
  latestActivityAt: '2026-11-11T09:00:00.000Z' as UtcDateTime,
  unread: 0,
  blockedByMe: false,
  ...over,
});

let counter = 0;
const message = (over: Partial<Message> = {}): Message => ({
  id: `m${++counter}` as MessageId,
  conversationId: 'lamp-chat' as ConversationId,
  senderId: 'test:bea' as UserId,
  mine: false,
  body: 'Is this still available?',
  createdAt: '2026-11-11T09:00:00.000Z' as UtcDateTime,
  delivery: { status: 'sent' },
  ...over,
});

/** A chat service whose live changes the test sends by hand. */
function fakeChat(conversations: readonly ConversationSummary[]) {
  const listeners = new Set<ChatListener>();
  const list = jest.fn(() => Promise.resolve(ok(conversations)));
  const service = {
    list,
    get: jest.fn((id: ConversationId) =>
      Promise.resolve(
        ok({
          ...(conversations.find((entry) => entry.id === id) ?? summary({ id })),
          messages: [],
        } as ConversationDetail),
      ),
    ),
    markRead: jest.fn(() => Promise.resolve(ok(undefined))),
    subscribe: jest.fn((listener: ChatListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  } as unknown as ChatService;
  return {
    service,
    list,
    listeners,
    emit: (event: Parameters<ChatListener>[0]) =>
      act(async () => {
        listeners.forEach((listener) => listener(event));
      }),
  };
}

function Viewing({ id }: { readonly id: string }) {
  useConversation(id);
  return null;
}

function show(
  chat: ReturnType<typeof fakeChat>,
  options: {
    readonly open?: (id: string) => void;
    readonly wants?: (kind: 'messages' | 'offers') => boolean | Promise<boolean>;
    readonly viewing?: string;
  } = {},
) {
  return renderScreen(
    <ChatServiceProvider service={chat.service}>
      <BannerProvider>
        {options.viewing ? <Viewing id={options.viewing} /> : null}
        <ChatBannerHost onOpenConversation={options.open ?? jest.fn()} wants={options.wants} />
      </BannerProvider>
    </ChatServiceProvider>,
  );
}

beforeEach(() => {
  mockSession.status = 'member';
});

describe('chatBannerFor', () => {
  const chat = summary();

  it('says what someone wrote, and who from', () => {
    expect(chatBannerFor(message({ body: 'Is this still available?' }), chat)).toMatchObject({
      title: '@bea',
      body: 'Is this still available?',
      kind: 'messages',
    });
  });

  it('cuts a long message short', () => {
    const banner = chatBannerFor(message({ body: 'word '.repeat(80) }), chat);

    expect(banner?.body.length).toBeLessThanOrEqual(140);
    expect(banner?.body.endsWith('…')).toBe(true);
  });

  it('leads an offer with what it is, and its note after', () => {
    const offer = message({ body: 'Cash today', offer: { amountPhp: 1200, status: 'pending' } });

    expect(chatBannerFor(offer, chat)).toMatchObject({
      body: 'Offered ₱1,200 on Brass lamp · Cash today',
      kind: 'offers',
    });
  });

  it('says where and when a meetup is proposed', () => {
    const meetup = message({
      body: '',
      meetup: {
        place: 'SM Seaside',
        when: 'Saturday, 2:00 PM',
        status: 'proposed',
        purpose: 'pickup',
      },
    });

    expect(chatBannerFor(meetup, chat)?.body).toBe(
      'Proposed a pickup at SM Seaside, Saturday, 2:00 PM',
    );
  });

  it('is none for the viewer’s own messages', () => {
    expect(chatBannerFor(message({ mine: true }), chat)).toBeNull();
  });

  it('is none for an offer or meetup that was answered rather than made', () => {
    const accepted = message({ offer: { amountPhp: 1200, status: 'accepted' } });
    const confirmed = message({
      body: '',
      meetup: { place: 'SM', when: 'Today, 2:00 PM', status: 'confirmed', purpose: 'pickup' },
    });

    expect(chatBannerFor(accepted, chat)).toBeNull();
    expect(chatBannerFor(confirmed, chat)).toBeNull();
  });

  it('still says something when the chat isn’t known yet', () => {
    expect(chatBannerFor(message(), undefined)?.title).toBe('New message');
  });
});

describe('ChatBannerHost', () => {
  it('shows a banner for a new message, and tapping it opens that chat', async () => {
    const chat = fakeChat([summary()]);
    const open = jest.fn();
    show(chat, { open });

    await chat.emit({ type: 'message', message: message({ body: 'Hello there' }) });

    expect(await screen.findByText('@bea')).toBeOnTheScreen();
    expect(screen.getByText('Hello there')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: '@bea. Hello there' }));
    expect(open).toHaveBeenCalledWith('lamp-chat');
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it('shows nothing for the viewer’s own message', async () => {
    const chat = fakeChat([summary()]);
    show(chat);

    await chat.emit({ type: 'message', message: message({ mine: true, body: 'My own words' }) });

    expect(screen.queryByText('My own words')).toBeNull();
  });

  it('shows nothing for the conversation already on screen, but does for another', async () => {
    const chat = fakeChat([summary(), summary({ id: 'radio-chat' as ConversationId })]);
    show(chat, { viewing: 'lamp-chat' });
    await act(async () => undefined);

    await chat.emit({ type: 'message', message: message({ body: 'In the open chat' }) });
    expect(screen.queryByText('In the open chat')).toBeNull();

    await chat.emit({
      type: 'message',
      message: message({ conversationId: 'radio-chat' as ConversationId, body: 'In another chat' }),
    });
    expect(await screen.findByText('In another chat')).toBeOnTheScreen();
  });

  it('banners an offer and a meetup proposal, but not their answers', async () => {
    const chat = fakeChat([summary()]);
    show(chat);

    await chat.emit({
      type: 'message',
      message: message({ body: '', offer: { amountPhp: 900, status: 'accepted' } }),
    });
    expect(screen.queryByText(/Offered/)).toBeNull();

    await chat.emit({
      type: 'message',
      message: message({ body: '', offer: { amountPhp: 900, status: 'pending' } }),
    });
    expect(await screen.findByText('Offered ₱900 on Brass lamp')).toBeOnTheScreen();
  });

  it('shows a message once, however many times it arrives', async () => {
    const chat = fakeChat([summary()]);
    const open = jest.fn();
    show(chat, { open });
    const again = message({ body: 'Once only' });

    await chat.emit({ type: 'message', message: again });
    fireEvent.press(await screen.findByRole('button', { name: '@bea. Once only' }));
    await chat.emit({ type: 'message', message: again });

    expect(screen.queryByText('Once only')).toBeNull();
  });

  it('finds a chat that has only just begun', async () => {
    const chat = fakeChat([]);
    show(chat);
    // The new chat appears in the list only once the service is asked again.
    chat.list.mockResolvedValue(ok([summary({ id: 'new-chat' as ConversationId })]));

    await chat.emit({
      type: 'message',
      message: message({ conversationId: 'new-chat' as ConversationId, body: 'First message' }),
    });

    expect(await screen.findByText('@bea')).toBeOnTheScreen();
  });

  it('respects what the person asked to hear about', async () => {
    const chat = fakeChat([summary()]);
    const wants = jest.fn((kind: 'messages' | 'offers') => kind === 'offers');
    show(chat, { wants });

    await chat.emit({ type: 'message', message: message({ body: 'A message' }) });
    expect(screen.queryByText('A message')).toBeNull();
    expect(wants).toHaveBeenCalledWith('messages');

    await chat.emit({
      type: 'message',
      message: message({ body: '', offer: { amountPhp: 500, status: 'pending' } }),
    });
    expect(await screen.findByText('Offered ₱500 on Brass lamp')).toBeOnTheScreen();
  });

  it('stays quiet about a chat the viewer blocked', async () => {
    const chat = fakeChat([summary({ blockedByMe: true })]);
    show(chat);

    await chat.emit({ type: 'message', message: message({ body: 'From a blocked person' }) });

    expect(screen.queryByText('From a blocked person')).toBeNull();
  });

  it('drops what belonged to the old account when the account changes', async () => {
    const chat = fakeChat([]);
    let release: (value: ReturnType<typeof ok<readonly ConversationSummary[]>>) => void = () =>
      undefined;
    show(chat);
    chat.list.mockReturnValue(new Promise((resolve) => (release = resolve)));

    await chat.emit({
      type: 'message',
      message: message({
        conversationId: 'new-chat' as ConversationId,
        body: 'For the old account',
      }),
    });
    // Someone else signs in before the old account's chat has been looked up.
    await chat.emit({ type: 'account', signedIn: true });
    await act(async () => release(ok([summary({ id: 'new-chat' as ConversationId })])));

    expect(screen.queryByText('For the old account')).toBeNull();
  });

  it('takes down a banner when the account changes', async () => {
    const chat = fakeChat([summary()]);
    show(chat);
    await chat.emit({ type: 'message', message: message({ body: 'For the old account' }) });
    expect(await screen.findByText('For the old account')).toBeOnTheScreen();

    await chat.emit({ type: 'account', signedIn: false });

    expect(screen.queryByText('For the old account')).toBeNull();
  });

  it('does not listen for a guest', async () => {
    mockSession.status = 'guest';
    const chat = fakeChat([summary()]);
    show(chat);

    await act(async () => undefined);

    expect(chat.listeners.size).toBe(0);
  });
});
