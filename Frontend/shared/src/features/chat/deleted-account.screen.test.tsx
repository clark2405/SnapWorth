import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createLocalChatRepository, type KeyValueStore } from '../../adapters';
import type { ChatRepository } from '../../ports/chat';
import { renderScreen } from '../../testing/render-screen';
import { createChatService } from '../../services';
import type { UtcDateTime } from '../../types/date-time';
import type { ConversationDetail, ConversationSummary } from '../../types/entities';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import { ok } from '../../types/result';
import { ChatServiceProvider } from './chat-state';
import { ConversationListView, ConversationRow } from './ConversationListView';
import { ConversationView } from './ConversationView';

const store: KeyValueStore = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
};
const at = '2026-11-12T10:00:00.000Z' as UtcDateTime;

/** A chat whose other person deleted their account, and whose listing is gone with them. */
const summary: ConversationSummary = {
  id: 'gone-chat' as ConversationId,
  listing: { key: '', title: 'Deleted listing', askingPricePhp: 0 },
  other: { userId: '' as UserId, handle: 'Deleted account' },
  otherGone: true,
  iAmSeller: false,
  latest: { fromMe: false, body: 'Yes, come by anytime.' },
  latestActivityAt: at,
  unread: 0,
  closed: 'deleted',
  blockedByMe: false,
};
const detail: ConversationDetail = {
  ...summary,
  messages: [
    {
      id: 'm1' as MessageId,
      conversationId: summary.id,
      senderId: 'me' as UserId,
      mine: true,
      body: 'Is the lamp still here?',
      createdAt: at,
      delivery: { status: 'delivered', deliveredAt: at },
    },
    {
      id: 'm2' as MessageId,
      conversationId: summary.id,
      senderId: '' as UserId,
      mine: false,
      body: 'Yes, come by anytime.',
      createdAt: at,
      delivery: { status: 'delivered', deliveredAt: at },
    },
  ],
};

function service() {
  const base = createLocalChatRepository({
    store,
    viewer: { userId: 'me' as UserId, handle: 'me' },
    seed: [],
    findListing: () => undefined,
  });
  const repository: ChatRepository = {
    ...base,
    list: async () => ok([summary]),
    get: async () => ok(detail),
  };
  return createChatService(repository);
}

describe('a chat whose other person deleted their account', () => {
  it('goes under Past, not Open, in the list', async () => {
    renderScreen(
      <GestureHandlerRootView>
        <ChatServiceProvider service={service()}>
          <ConversationListView />
        </ChatServiceProvider>
      </GestureHandlerRootView>,
    );
    // A closed chat is not open: it waits under Past (the segmented control is native).
    expect(await screen.findByText('No open chats')).toBeOnTheScreen();
  });

  it('is a row that says "Deleted account", closed, with no @handle', () => {
    renderScreen(<ConversationRow conversation={summary} />);

    expect(screen.getByText('Deleted account')).toBeOnTheScreen();
    expect(screen.getByText('Closed')).toBeOnTheScreen();
    expect(screen.getByText('Deleted listing')).toBeOnTheScreen();
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it('opens as "Deleted account" with the history, a closed notice and no way to write', async () => {
    const onViewItem = jest.fn();
    renderScreen(
      <GestureHandlerRootView>
        <ChatServiceProvider service={service()}>
          <ConversationView conversationId="gone-chat" onViewItem={onViewItem} />
        </ChatServiceProvider>
      </GestureHandlerRootView>,
    );

    expect(await screen.findByText('Deleted account')).toBeOnTheScreen();
    expect(screen.getByText('Is the lamp still here?')).toBeOnTheScreen();
    expect(screen.getByText('Yes, come by anytime.')).toBeOnTheScreen();
    expect(
      screen.getByText('This account was deleted. The conversation is closed.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.queryByLabelText('Report or block')).toBeNull();
    // The listing is gone, so the item card goes nowhere.
    fireEvent.press(screen.getByLabelText(/View item, Deleted listing/));
    expect(onViewItem).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/@/)).toBeNull());
  });
});
