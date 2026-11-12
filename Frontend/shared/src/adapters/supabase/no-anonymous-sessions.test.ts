import type { SupabaseClient } from '@supabase/supabase-js';

import { createPhotoPricingService } from './pricing';
import { createSupabaseChatRepository } from './chat-repository';
import { createSupabaseCommentRepository } from './comment-repository';
import { createSupabaseFeedRepository } from './feed-repository';
import { createSupabaseHanapRepository } from './hanap-repository';
import { createSupabaseMarketplaceRepository } from './marketplace-repository';
import { createSupabaseSukiRepository } from './suki-repository';

/**
 * A device with no account. Looking around (the Feed, Market, Chats, Hanap, comments) must work
 * as the signed-out role without creating a session, and doing something must be refused rather
 * than quietly signing the device in as someone: an anonymous account made every visitor look
 * like a member and undid logging out.
 */
function signedOutClient() {
  const signInAnonymously = jest.fn(async () => ({
    data: { user: { id: 'anon' }, session: {} },
    error: null,
  }));
  const signUp = jest.fn();
  // Any query builder call returns the builder; awaiting it gives an empty answer.
  const query: unknown = new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === 'then') {
        return (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
      }
      // No such row.
      if (property === 'maybeSingle' || property === 'single') {
        return async () => ({ data: null, error: null });
      }
      return () => query;
    },
    apply: () => query,
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInAnonymously,
      signUp,
    },
    from: () => query,
    rpc: () => query,
    storage: { from: () => query },
    functions: { invoke: async () => ({ data: null, error: null }) },
    channel: () => query,
    removeChannel: () => undefined,
  };
  return { client: client as unknown as SupabaseClient, signInAnonymously, signUp };
}

const denied = { ok: false, error: { kind: 'authorization', code: 'not_found_or_denied' } };

describe('with nobody signed in', () => {
  it('lets the Feed be read, and refuses voting, posting and deleting', async () => {
    const { client, signInAnonymously } = signedOutClient();
    const feed = createSupabaseFeedRepository(client, {
      scanPhotos: { upload: async () => null, links: async () => ({}) },
    });
    await feed.list();
    await feed.getByIdOrSlug('retro-windbreaker');
    expect(await feed.listVotes()).toEqual({ ok: true, value: [] });
    expect(await feed.setVote('retro-windbreaker', 'too_high')).toMatchObject(denied);
    expect(await feed.publish({ title: 'A', body: 'B' })).toMatchObject(denied);
    expect(await feed.remove('retro-windbreaker')).toMatchObject(denied);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('lets the Market be read, and refuses selling and saving', async () => {
    const { client, signInAnonymously } = signedOutClient();
    const market = createSupabaseMarketplaceRepository(client, {
      upload: async () => null,
      links: async () => ({}),
    });
    await market.list();
    await market.findById('polaroid-sun-600');
    await market.sellerByHandle('mariacruz');
    expect(await market.listSaved()).toEqual({ ok: true, value: [] });
    const listing = {
      title: 'A',
      askingPrice: 100,
      category: 'collectibles' as const,
      condition: 'good' as const,
      area: 'cebu-city' as const,
      description: '',
    };
    expect(await market.publish(listing)).toMatchObject(denied);
    expect(await market.update('x', { title: 'B' })).toMatchObject(denied);
    expect(await market.remove('x')).toMatchObject(denied);
    expect(await market.saveListing('x')).toMatchObject(denied);
    expect(await market.unsaveListing('x')).toMatchObject(denied);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('shows no chats and no meetups, and refuses messaging', async () => {
    const { client, signInAnonymously } = signedOutClient();
    const chats = createSupabaseChatRepository(client, {
      upload: async () => null,
      links: async () => ({}),
    });
    expect(await chats.list()).toEqual({ ok: true, value: [] });
    expect(await chats.confirmedMeetups('2026-01-01T00:00:00.000Z' as never)).toEqual({
      ok: true,
      value: [],
    });
    expect(await chats.start('polaroid-sun-600')).toMatchObject(denied);
    expect(await chats.get('c1' as never)).toMatchObject(denied);
    expect(
      await chats.send('m1' as never, 'c1' as never, { kind: 'text', body: 'hi' } as never),
    ).toMatchObject(denied);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('lets Hanap, comments and suki be read, and refuses posting, commenting and reporting', async () => {
    const { client, signInAnonymously } = signedOutClient();
    const hanap = createSupabaseHanapRepository(client);
    await hanap.list();
    expect(await hanap.post({ body: 'Looking for a Walkman', maxPhp: 2000 })).toMatchObject(denied);

    const comments = createSupabaseCommentRepository(client);
    await comments.listThread('retro-windbreaker');
    expect(await comments.insert({ postKey: 'retro-windbreaker', body: 'Nice' })).toMatchObject(
      denied,
    );
    expect(await comments.report('c1', 'spam')).toMatchObject(denied);

    const suki = createSupabaseSukiRepository(client);
    expect(await suki.discountWith('u2', true)).toEqual({ ok: true, value: null });
    expect(await suki.set('u2', 10)).toMatchObject(denied);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('asks for an account to price a photo instead of making one', async () => {
    const { client, signInAnonymously } = signedOutClient();
    const pricing = createPhotoPricingService(client);
    await expect(pricing.estimate({ data: 'AAAA', mimeType: 'image/jpeg' })).rejects.toThrow(
      'Sign in to get a price estimate.',
    );
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
