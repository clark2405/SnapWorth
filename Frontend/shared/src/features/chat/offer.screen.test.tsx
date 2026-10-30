import { act, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createLocalChatRepository, type KeyValueStore } from '../../adapters';
import { ToastProvider } from '../../components';
import { createChatService } from '../../services';
import type { UserId } from '../../types/ids';
import { ChatServiceProvider, useOfferToSeller } from './chat-state';

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

const service = createChatService(
  createLocalChatRepository({
    store: memoryStore(),
    viewer: { userId: 'test:me' as UserId, handle: 'me' },
    seed: [],
    findListing: (key) =>
      key === 'lamp'
        ? {
            listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
            seller: { userId: 'test:sam' as UserId, handle: 'sam' },
          }
        : undefined,
  }),
);

const metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastProvider>
        <ChatServiceProvider service={service}>{children}</ChatServiceProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

it('sends an offer into the chat with the seller', async () => {
  const { result } = renderHook(() => useOfferToSeller(), { wrapper });

  let conversationId: string | null = null;
  await act(async () => {
    conversationId = await result.current('lamp', 1300);
  });

  expect(conversationId).not.toBeNull();
  const chat = await service.get(conversationId!);
  expect(chat.ok && chat.value.messages.at(-1)?.offer).toEqual({
    amountPhp: 1300,
    status: 'pending',
  });
});

it('sends nothing for a listing it can’t find', async () => {
  const { result } = renderHook(() => useOfferToSeller(), { wrapper });

  let conversationId: string | null = 'unset';
  await act(async () => {
    conversationId = await result.current('nowhere', 500);
  });

  expect(conversationId).toBeNull();
  // The person is told it didn't go, rather than left wondering.
  expect(await screen.findByText('This conversation is no longer available')).toBeOnTheScreen();
});
