import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createLocalChatRepository, type KeyValueStore } from '../../adapters';
import { createChatService } from '../../services';
import type { UtcDateTime } from '../../types/date-time';
import type { UserId } from '../../types/ids';
import { ChatServiceProvider, useConversation, useUnreadChatCount } from './chat-state';

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

function wrapper({ children }: { readonly children: ReactNode }) {
  return <ChatServiceProvider service={service}>{children}</ChatServiceProvider>;
}

let service: ReturnType<typeof createChatService>;

beforeEach(() => {
  service = createChatService(
    createLocalChatRepository({
      store: memoryStore(),
      viewer: { userId: 'test:me' as UserId, handle: 'me' },
      seed: [
        {
          id: 'lamp-chat',
          listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
          other: { userId: 'test:bea' as UserId, handle: 'bea' },
          iAmSeller: true,
          unread: 2,
          messages: [
            { id: 'l1', fromMe: false, body: 'Hi!', createdAt: at(1) },
            { id: 'l2', fromMe: false, body: 'Still available?', createdAt: at(2) },
          ],
        },
        {
          id: 'radio-chat',
          listing: { key: 'radio', title: 'Radio', askingPricePhp: 900 },
          other: { userId: 'test:sam' as UserId, handle: 'sam' },
          iAmSeller: false,
          unread: 1,
          messages: [{ id: 'r1', fromMe: false, body: 'Yes, it works', createdAt: at(3) }],
        },
      ],
      findListing: () => undefined,
    }),
  );
});

it('counts every unread message across the chats', async () => {
  const { result } = renderHook(() => useUnreadChatCount(true), { wrapper });
  await waitFor(() => expect(result.current).toBe(3));
});

it('drops a chat’s messages from the count once it is opened', async () => {
  const { result, rerender } = renderHook(
    ({ open }: { readonly open?: string }) => {
      useConversation(open);
      return useUnreadChatCount(true);
    },
    { wrapper, initialProps: {} as { readonly open?: string } },
  );
  await waitFor(() => expect(result.current).toBe(3));
  rerender({ open: 'lamp-chat' });
  await waitFor(() => expect(result.current).toBe(1));
});

it('loads nothing for a guest', async () => {
  const list = jest.spyOn(service, 'list');
  const { result } = renderHook(() => useUnreadChatCount(false), { wrapper });
  await act(async () => {});
  expect(result.current).toBe(0);
  expect(list).not.toHaveBeenCalled();
});
