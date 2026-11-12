import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseChatRepository } from './chat-repository';

// What conversation_list returns for a chat whose other person deleted their account and whose
// listing went with them (20261112000100): nulls where their details were.
const row = {
  id: '00000000-0000-4000-a320-000000000001',
  listing_slug: null,
  listing_title: 'Deleted listing',
  listing_photo_url: null,
  asking_php: null,
  closed: 'deleted',
  other_id: null,
  other_handle: null,
  other_avatar_url: null,
  i_am_seller: false,
  last_kind: 'text',
  last_body: 'Yes, come by anytime.',
  last_offer_php: null,
  last_meetup_place: null,
  last_meetup_purpose: null,
  last_from_me: false,
  last_message_at: '2026-11-12T10:00:00.000Z',
  unread_count: 2,
  blocked_by_me: false,
};

function chatsWith(rows: unknown[], from: unknown = () => ({})) {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'usr_me' } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    rpc: async () => ({ data: rows, error: null }),
    from,
  } as unknown as SupabaseClient;
  return createSupabaseChatRepository(client, {
    upload: async () => null,
    links: async () => ({}),
  });
}

describe('a chat whose other person deleted their account', () => {
  it('lists with a placeholder person, closed as deleted, and no listing to open', async () => {
    const listed = await chatsWith([row]).list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value[0]).toMatchObject({
      otherGone: true,
      other: { userId: '', handle: 'Deleted account' },
      closed: 'deleted',
      listing: { key: '', title: 'Deleted listing', askingPricePhp: 0 },
      unread: 2,
      iAmSeller: false,
    });
  });

  it('opens with its messages, those of the deleted person from nobody', async () => {
    const messages = [
      {
        id: 'm1',
        conversation_id: row.id,
        sender_id: null,
        kind: 'text',
        body: 'Yes, come by anytime.',
        offer_php: null,
        offer_status: null,
        meetup_place: null,
        meetup_when: null,
        meetup_status: null,
        meetup_purpose: null,
        meetup_spot: null,
        meetup_lat: null,
        meetup_lng: null,
        created_at: '2026-11-12T10:00:00.000Z',
      },
    ];
    const from = () => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: async () => ({ data: messages, error: null }) }) }),
      }),
    });
    const opened = await chatsWith([row], from).get(row.id as never);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.otherGone).toBe(true);
    expect(opened.value.messages).toHaveLength(1);
    expect(opened.value.messages[0]?.mine).toBe(false);
  });

  it('still lists an ordinary chat as before', async () => {
    const listings = () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) });
    const listed = await chatsWith(
      [
        {
          ...row,
          listing_slug: 'gone-radio',
          listing_title: 'Radio',
          asking_php: 900,
          closed: null,
          other_id: 'usr_other',
          other_handle: 'sol_gone',
        },
      ],
      listings,
    ).list();
    expect(listed.ok && listed.value[0]).toMatchObject({
      otherGone: false,
      other: { userId: 'usr_other', handle: 'sol_gone' },
      listing: { key: 'gone-radio', askingPricePhp: 900 },
    });
    expect(listed.ok && listed.value[0]?.closed).toBeUndefined();
  });
});
