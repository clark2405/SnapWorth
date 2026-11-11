import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { UtcDateTime } from '../../types/date-time';
import type { PublicProfile } from '../../types/entities';
import type { UserId } from '../../types/ids';
import { createLocalChatRepository } from '../local/chat-repository';
import { createSupabaseChatRepository } from './chat-repository';

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 1, 0)).toISOString() as UtcDateTime;
const bea: PublicProfile = { userId: 'test:bea' as UserId, handle: 'bea' };

describe('createLocalChatRepository: confirmedMeetups', () => {
  const meetup = (status: 'proposed' | 'confirmed') => ({
    place: 'SM Seaside',
    when: 'Today, 2:00 PM',
    status,
    purpose: 'pickup' as const,
  });
  const repository = () =>
    createLocalChatRepository({
      store: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
      viewer: { userId: 'test:me' as UserId, handle: 'me' },
      findListing: () => undefined,
      seed: [
        {
          id: 'lamp-chat',
          listing: { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 },
          other: bea,
          iAmSeller: true,
          unread: 0,
          messages: [
            { id: 'old', fromMe: false, body: '', meetup: meetup('confirmed'), createdAt: at(1) },
            { id: 'new', fromMe: true, body: '', meetup: meetup('confirmed'), createdAt: at(10) },
            { id: 'open', fromMe: true, body: '', meetup: meetup('proposed'), createdAt: at(11) },
            { id: 'chat', fromMe: false, body: 'Hi', createdAt: at(12) },
          ],
        },
      ],
    });

  it('lists the meetups both agreed to since the date, with when they were proposed', async () => {
    const result = await repository().confirmedMeetups(at(5));

    expect(result).toEqual({
      ok: true,
      value: [
        {
          messageId: 'new',
          conversationId: 'lamp-chat',
          place: 'SM Seaside',
          when: 'Today, 2:00 PM',
          purpose: 'pickup',
          proposedAt: at(10),
        },
      ],
    });
  });

  it('leaves out a proposal nobody has confirmed', async () => {
    const result = await repository().confirmedMeetups(at(1));

    expect(result.ok && result.value.map((entry) => entry.messageId)).toEqual(['old', 'new']);
  });
});

describe('createSupabaseChatRepository: confirmedMeetups', () => {
  /** A client whose `messages` query records what was asked, and answers with `result`. */
  function clientAnswering(result: { data: unknown; error: unknown }) {
    const asked: string[] = [];
    const query: Record<string, unknown> = {};
    for (const step of ['select', 'eq', 'gte', 'order', 'limit']) {
      query[step] = jest.fn((...args: unknown[]) => {
        asked.push(`${step}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`);
        return step === 'limit' ? Promise.resolve(result) : query;
      });
    }
    const client = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: jest.fn(() => query),
    };
    return { client: client as unknown as SupabaseClient, asked };
  }

  it('reads the confirmed meetups the viewer’s chats hold since the date', async () => {
    const { client, asked } = clientAnswering({
      data: [
        {
          id: 'm1',
          conversation_id: 'c1',
          meetup_place: 'SM Seaside',
          meetup_when: 'Saturday, 6:00 PM',
          meetup_purpose: 'viewing',
          created_at: '2026-11-10T01:00:00.000Z',
        },
        {
          id: 'm2',
          conversation_id: 'c2',
          meetup_place: 'Ayala',
          meetup_when: 'Today, 2:00 PM',
          meetup_purpose: null,
          created_at: '2026-11-11T01:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await createSupabaseChatRepository(client).confirmedMeetups(at(5));

    expect(asked).toEqual([
      'select("id, conversation_id, meetup_place, meetup_when, meetup_purpose, created_at")',
      'eq("kind", "meetup")',
      'eq("meetup_status", "confirmed")',
      `gte("created_at", ${JSON.stringify(at(5))})`,
      'order("created_at", {"ascending":true})',
      'limit(100)',
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          messageId: 'm1',
          conversationId: 'c1',
          place: 'SM Seaside',
          when: 'Saturday, 6:00 PM',
          purpose: 'viewing',
          proposedAt: '2026-11-10T01:00:00.000Z',
        },
        expect.objectContaining({ messageId: 'm2', purpose: 'pickup' }),
      ],
    });
  });

  it('reports a failure instead of an empty list', async () => {
    const { client } = clientAnswering({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const result = await createSupabaseChatRepository(client).confirmedMeetups(at(5));

    expect(result).toMatchObject({ ok: false, error: { kind: 'authorization' } });
  });
});
