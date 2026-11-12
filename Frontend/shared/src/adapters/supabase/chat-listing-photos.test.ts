import { createSupabaseChatRepository } from './chat-repository';

const row = (slug: string) => ({
  id: `conv-${slug}`,
  listing_slug: slug,
  listing_title: `Title ${slug}`,
  listing_photo_url: null,
  asking_php: 1500,
  closed: null,
  other_id: 'usr_2',
  other_handle: 'sam',
  other_avatar_url: null,
  i_am_seller: false,
  last_kind: null,
  last_body: null,
  last_offer_php: null,
  last_meetup_place: null,
  last_meetup_purpose: null,
  last_from_me: null,
  last_message_at: '2026-11-10T10:00:00.000Z',
  unread_count: 0,
  blocked_by_me: false,
});

describe('chat listing photos', () => {
  it('gives each conversation its listing’s photo, as a link that works for a while', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      rpc: async () => ({ data: [row('with-photo'), row('without-photo')], error: null }),
      from: (table: string) => {
        expect(table).toBe('listings');
        return {
          select: () => ({
            in: async () => ({
              data: [
                { slug: 'with-photo', photo_path: 'usr_2/scan_1.jpg' },
                { slug: 'without-photo', photo_path: null },
              ],
              error: null,
            }),
          }),
        };
      },
    };
    const repo = createSupabaseChatRepository(client as never, {
      upload: async () => null,
      links: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed.test/${p}`])),
      remove: async () => true,
    });

    const list = await repo.list();

    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value[0]?.listing.photoUrl).toBe('https://signed.test/usr_2/scan_1.jpg');
    expect(list.value[1]?.listing.photoUrl).toBeUndefined();
  });
});
