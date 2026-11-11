import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createLocalFeedRepository } from '../local/feed-repository';
import { createSupabaseFeedRepository } from './feed-repository';

describe('createLocalFeedRepository', () => {
  it('publishes posts with rule screening, toggles votes, and removes posts', async () => {
    const repo = createLocalFeedRepository({ viewerHandle: 'maya' });

    const created = await repo.publish({
      title: 'Vintage Casio F-91W',
      body: 'Is ₱650 fair for a clean vintage Casio?',
      estimate: 650,
      category: 'collectibles',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.moderationStatus).toBe('approved');
    expect(created.value.author.handle).toBe('maya');
    expect(created.value.votes).toEqual({ too_high: 0, just_right: 0, too_low: 0 });

    // Casting a vote increments the tally and records the voter's choice
    const voted = await repo.setVote(created.value.slug, 'just_right');
    expect(voted.ok).toBe(true);
    if (voted.ok) {
      expect(voted.value.votes).toEqual({ too_high: 0, just_right: 1, too_low: 0 });
    }

    // Changing the vote moves the count from just_right to too_high
    const changed = await repo.setVote(created.value.slug, 'too_high');
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.value.votes).toEqual({ too_high: 1, just_right: 0, too_low: 0 });
    }

    // Withdrawing the vote decrements the count back to zero
    const withdrawn = await repo.setVote(created.value.slug, null);
    expect(withdrawn.ok).toBe(true);
    if (withdrawn.ok) {
      expect(withdrawn.value.votes).toEqual({ too_high: 0, just_right: 0, too_low: 0 });
    }

    // A post containing off-platform contact instructions is held for review
    const held = await repo.publish({
      title: 'Suspicious Listing',
      body: 'DM me on telegram for price',
      estimate: 1000,
    });
    expect(held.ok).toBe(true);
    if (held.ok) {
      expect(held.value.moderationStatus).toBe('held');
    }

    const removed = await repo.remove(created.value.id);
    expect(removed.ok).toBe(true);
  });
});

describe('createSupabaseFeedRepository', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const scanId = '00000000-0000-4000-9000-000000000010';
  const postId = '00000000-0000-4000-9500-000000000020';

  it('publishes a scan to feed_posts, screens via moderate-content, and resolves its scan photo', async () => {
    const insertedPayloads: Record<string, unknown>[] = [];
    const invokeCalls: { fn: string; body: unknown }[] = [];

    const client = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { id: userId } } },
          error: null,
        })),
      },
      functions: {
        invoke: jest.fn(async (fn: string, options: { body: unknown }) => {
          invokeCalls.push({ fn, body: options.body });
          return { data: { status: 'approved' }, error: null };
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'feed_posts') {
          return {
            insert: (payload: Record<string, unknown>) => {
              insertedPayloads.push(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: postId,
                      slug: 'seiko-5-00000020',
                      owner_id: userId,
                      title: payload.title,
                      category: payload.category,
                      body: payload.body,
                      // The database copies this from the scan; the client never sends one.
                      estimate_php: 3200,
                      scan_id: payload.scan_id,
                      listing_id: payload.listing_id,
                      photo_path: payload.photo_path,
                      too_high_count: 0,
                      just_right_count: 0,
                      too_low_count: 0,
                      moderation_status: 'pending',
                      created_at: '2026-11-10T10:00:00.000Z',
                      author: { id: userId, handle: 'retro_curator', avatar_url: null },
                      listing: null,
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const repo = createSupabaseFeedRepository(client, {
      scanPhotos: {
        upload: async () => null,
        links: async (paths) =>
          Object.fromEntries(paths.map((p) => [p, `https://signed.example/${p}`])),
      },
    });

    const result = await repo.publish({
      title: 'Seiko 5 Automatic',
      body: 'Is ₱3,200 right for this Seiko 5?',
      estimate: 3200,
      category: 'collectibles',
      scanId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(insertedPayloads[0]).toMatchObject({
      title: 'Seiko 5 Automatic',
      body: 'Is ₱3,200 right for this Seiko 5?',
      scan_id: scanId,
      photo_path: `${userId}/${scanId}.jpg`,
    });
    expect(insertedPayloads[0]).not.toHaveProperty('estimate_php');
    expect(result.value.estimate).toBe(3200);
    expect(invokeCalls).toEqual([{ fn: 'moderate-content', body: { type: 'post', id: postId } }]);
    expect(result.value.moderationStatus).toBe('approved');
    expect(result.value.photoUrl).toBe(`https://signed.example/${userId}/${scanId}.jpg`);
  });

  it('upserts and deletes votes and returns updated post tallies', async () => {
    const upsertedVotes: Record<string, unknown>[] = [];
    let deletedVote = false;

    const client = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { id: userId } } },
          error: null,
        })),
      },
      from: jest.fn((table: string) => {
        if (table === 'feed_posts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: postId,
                    slug: 'retro-windbreaker',
                    owner_id: userId,
                    body: 'Fair price?',
                    estimate_php: 2450,
                    too_high_count: 12,
                    just_right_count: deletedVote ? 38 : 39,
                    too_low_count: 4,
                    moderation_status: 'approved',
                    created_at: '2026-11-10T10:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return {
            upsert: async (payload: Record<string, unknown>) => {
              upsertedVotes.push(payload);
              return { error: null };
            },
            delete: () => ({
              eq: () => ({
                eq: async () => {
                  deletedVote = true;
                  return { error: null };
                },
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const repo = createSupabaseFeedRepository(client, {
      scanPhotos: { upload: async () => null, links: async () => ({}) },
    });

    const cast = await repo.setVote('retro-windbreaker', 'just_right');
    expect(cast.ok).toBe(true);
    expect(upsertedVotes).toEqual([{ post_id: postId, user_id: userId, choice: 'just_right' }]);
    if (cast.ok) {
      expect(cast.value.votes.just_right).toBe(39);
    }

    const withdrawn = await repo.setVote('retro-windbreaker', null);
    expect(withdrawn.ok).toBe(true);
    expect(deletedVote).toBe(true);
    if (withdrawn.ok) {
      expect(withdrawn.value.votes.just_right).toBe(38);
    }
  });
});
