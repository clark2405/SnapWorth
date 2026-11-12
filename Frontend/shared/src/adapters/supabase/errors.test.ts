import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseChatRepository } from './chat-repository';
import { toAppError } from './errors';

describe('toAppError', () => {
  it('says "not found" for an id that is not a uuid (Postgres 22P02), not "unknown"', () => {
    expect(
      toAppError(
        { code: '22P02', message: 'invalid input syntax for type uuid: "abc"' },
        'load_messages',
      ),
    ).toEqual({ kind: 'authorization', code: 'not_found_or_denied' });
  });

  it('still says unknown for an error it has no word for', () => {
    expect(toAppError({ code: 'XX000' }, 'load_messages')).toMatchObject({ kind: 'unknown' });
  });
});

describe('opening a chat by a malformed id', () => {
  it('answers "not found" without asking the database', async () => {
    const rpc = jest.fn();
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      rpc,
      from: jest.fn(),
    } as unknown as SupabaseClient;
    const chats = createSupabaseChatRepository(client, {
      upload: async () => null,
      links: async () => ({}),
    });

    for (const id of ['abc', '', 'not-a-uuid-at-all', '1234']) {
      expect(await chats.get(id as never)).toEqual({
        ok: false,
        error: { kind: 'authorization', code: 'not_found_or_denied' },
      });
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('maps the database’s own 22P02 for the other chat lookups', async () => {
    const rpc = jest.fn(async () => ({
      data: null,
      error: { code: '22P02', message: 'invalid uuid' },
    }));
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      rpc,
    } as unknown as SupabaseClient;
    const chats = createSupabaseChatRepository(client, {
      upload: async () => null,
      links: async () => ({}),
    });
    expect(await chats.markRead('bad' as never)).toMatchObject({
      ok: false,
      error: { kind: 'authorization' },
    });
  });
});
