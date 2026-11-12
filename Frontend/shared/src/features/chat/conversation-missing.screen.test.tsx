import { screen } from '@testing-library/react-native';

import type { ChatRepository } from '../../ports/chat';
import { createChatService } from '../../services';
import { renderScreen } from '../../testing/render-screen';
import type { AppError } from '../../types/errors';
import { err, ok } from '../../types/result';
import { ChatServiceProvider } from './chat-state';
import { ConversationView } from './ConversationView';

/** A chat service whose conversations can't be had, for the stated reason. */
function failingWith(error: AppError) {
  const repository = {
    list: async () => ok([]),
    get: async () => err(error),
    subscribe: () => () => undefined,
  } as unknown as ChatRepository;
  return createChatService(repository);
}

function open(id: string | undefined, error: AppError) {
  renderScreen(
    <ChatServiceProvider service={failingWith(error)}>
      <ConversationView conversationId={id} />
    </ChatServiceProvider>,
  );
}

describe('a chat that cannot be opened', () => {
  it('says it isn’t available for one that is not there or not yours', async () => {
    open('0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d', {
      kind: 'authorization',
      code: 'not_found_or_denied',
    });

    expect(await screen.findByText('This conversation isn’t available')).toBeOnTheScreen();
    expect(screen.queryByText(/connection/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('says it isn’t available for an address that is not a chat’s', async () => {
    open('not-a-chat', { kind: 'validation', code: 'rejected' });

    expect(await screen.findByText('This conversation isn’t available')).toBeOnTheScreen();
    expect(screen.queryByText(/connection/i)).toBeNull();
  });

  it('says it isn’t available when there is no address at all', async () => {
    open(undefined, { kind: 'offline', operation: 'load_messages', retryable: true });

    expect(await screen.findByText('This conversation isn’t available')).toBeOnTheScreen();
  });

  it('blames the connection only when the request itself failed', async () => {
    open('0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d', {
      kind: 'offline',
      operation: 'load_messages',
      retryable: true,
    });

    expect(await screen.findByText('Couldn’t load this chat')).toBeOnTheScreen();
    expect(screen.getByText('Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('does not blame the connection for something else going wrong', async () => {
    open('0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d', {
      kind: 'unknown',
      requestId: '500',
      retryable: true,
    });

    expect(await screen.findByText('Couldn’t load this chat')).toBeOnTheScreen();
    expect(screen.queryByText(/connection/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
