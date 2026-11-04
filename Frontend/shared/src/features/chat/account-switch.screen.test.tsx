import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createLocalChatRepository, type KeyValueStore } from '../../adapters';
import type { ChatListener, ChatRepository } from '../../ports/chat';
import { createChatService } from '../../services';
import type { UtcDateTime } from '../../types/date-time';
import type { UserId } from '../../types/ids';
import { ChatServiceProvider, useConversationList } from './chat-state';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 1, 10, minute)).toISOString() as UtcDateTime;

/** Two people's chats on one phone: Ana's lamp chat and Ben's radio chat. */
const accounts = {
  ana: createLocalChatRepository({
    store: memoryStore(),
    viewer: { userId: 'test:ana' as UserId, handle: 'ana' },
    seed: [
      {
        id: 'ana-lamp',
        listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
        other: { userId: 'test:sam' as UserId, handle: 'sam' },
        iAmSeller: false,
        messages: [{ id: 'a1', fromMe: true, body: 'Still available?', createdAt: at(1) }],
      },
    ],
    findListing: () => undefined,
  }),
  ben: createLocalChatRepository({
    store: memoryStore(),
    viewer: { userId: 'test:ben' as UserId, handle: 'ben' },
    seed: [
      {
        id: 'ben-radio',
        listing: { key: 'radio', title: 'Radio', askingPricePhp: 900 },
        other: { userId: 'test:sam' as UserId, handle: 'sam' },
        iAmSeller: false,
        messages: [{ id: 'b1', fromMe: true, body: 'Sounds good', createdAt: at(2) }],
      },
    ],
    findListing: () => undefined,
  }),
};

// Whoever is signed in answers; the test announces account changes the way Supabase's adapter
// does when someone signs in, out, or as someone else.
let signedIn: keyof typeof accounts = 'ana';
const listeners = new Set<ChatListener>();
const phone = new Proxy({} as ChatRepository, {
  get: (_target, name) =>
    name === 'subscribe'
      ? (listener: ChatListener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      : (...args: unknown[]) =>
          (Reflect.get(accounts[signedIn], name) as (...values: unknown[]) => unknown)(...args),
});
const service = createChatService(phone);
const announce = (next: keyof typeof accounts | null) => {
  if (next) signedIn = next;
  listeners.forEach((listener) => listener({ type: 'account', signedIn: next !== null }));
};

function wrapper({ children }: { readonly children: ReactNode }) {
  return <ChatServiceProvider service={service}>{children}</ChatServiceProvider>;
}

beforeEach(() => {
  signedIn = 'ana';
});

it('never shows the last account’s chats to whoever signs in next', async () => {
  const seen = new Set<string>();
  const { result } = renderHook(
    () => {
      const list = useConversationList();
      list.conversations.forEach((conversation) => seen.add(conversation.id));
      return list;
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.conversations.map((c) => c.id)).toEqual(['ana-lamp']));

  // Ben signs in on the same phone: Ana's chat leaves at once, then Ben's arrive.
  seen.clear();
  act(() => announce('ben'));
  expect(result.current.conversations).toEqual([]);
  await waitFor(() => expect(result.current.conversations.map((c) => c.id)).toEqual(['ben-radio']));
  expect(seen.has('ana-lamp')).toBe(false);
});

it('drops a list that was still loading for the old account', async () => {
  const seen = new Set<string>();
  const { result } = renderHook(
    () => {
      const list = useConversationList();
      list.conversations.forEach((conversation) => seen.add(conversation.id));
      return list;
    },
    { wrapper },
  );
  // Ana's list is on its way when Ben signs in.
  act(() => announce('ben'));
  await waitFor(() => expect(result.current.conversations.map((c) => c.id)).toEqual(['ben-radio']));
  expect(seen.has('ana-lamp')).toBe(false);
});

it('clears the chats on signing out, without loading anyone’s', async () => {
  const { result } = renderHook(() => useConversationList(), { wrapper });
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));

  const listing = jest.spyOn(accounts.ana, 'list');
  act(() => announce(null));
  expect(result.current.conversations).toEqual([]);
  await act(async () => {
    await Promise.resolve();
  });
  expect(listing).not.toHaveBeenCalled();
  expect(result.current.conversations).toEqual([]);
});
