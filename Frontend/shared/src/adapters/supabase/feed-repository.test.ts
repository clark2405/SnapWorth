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

  /**
   * A votes table that behaves like the live one: the grants allow insert(post_id, choice) and
   * update(choice) only, so any write that sends `user_id`, or an upsert (whose DO UPDATE would
   * rewrite post_id and user_id), is refused with 42501, and an update only reaches the caller's
   * own row.
   */
  function votesClient(existing: { choice: string } | null, insertFailsWith?: string) {
    const calls: { op: string; payload?: Record<string, unknown>; filters: [string, unknown][] }[] =
      [];
    let row = existing;
    const refused = { code: '42501', message: 'permission denied for table votes' };
    const votes = {
      update: (payload: Record<string, unknown>) => {
        const filters: [string, unknown][] = [];
        calls.push({ op: 'update', payload, filters });
        const chain = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          },
          select: async () => {
            if (Object.keys(payload).some((key) => key !== 'choice')) {
              return { data: null, error: refused };
            }
            if (row) row = { choice: payload.choice as string };
            return { data: row ? [{ post_id: postId }] : [], error: null };
          },
        };
        return chain;
      },
      insert: async (payload: Record<string, unknown>) => {
        calls.push({ op: 'insert', payload, filters: [] });
        if (Object.keys(payload).some((key) => key !== 'post_id' && key !== 'choice')) {
          return { error: refused };
        }
        if (insertFailsWith) {
          // Someone else got in first: the vote exists by now.
          row = { choice: 'too_high' };
          return { error: { code: insertFailsWith, message: 'duplicate key' } };
        }
        row = { choice: payload.choice as string };
        return { error: null };
      },
      upsert: async () => {
        calls.push({ op: 'upsert', filters: [] });
        return { error: refused };
      },
      delete: () => {
        const chain = {
          eq: (): unknown => chain,
          then: (resolve: (value: { error: null }) => void) => {
            calls.push({ op: 'delete', filters: [] });
            row = null;
            resolve({ error: null });
          },
        };
        return chain;
      },
    };
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
                    owner_id: '00000000-0000-4000-8000-0000000000aa',
                    body: 'Fair price?',
                    estimate_php: 2450,
                    too_high_count: 12,
                    just_right_count: 39,
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
        if (table === 'votes') return votes;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;
    const repo = createSupabaseFeedRepository(client, {
      scanPhotos: { upload: async () => null, links: async () => ({}) },
    });
    return { repo, calls, current: () => row };
  }

  it('adds a first vote with an update that changes nothing, then an insert without user_id', async () => {
    const { repo, calls, current } = votesClient(null);
    const cast = await repo.setVote('retro-windbreaker', 'just_right');
    expect(cast.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['update', 'insert']);
    expect(calls[0]?.payload).toEqual({ choice: 'just_right' });
    expect(calls[1]?.payload).toEqual({ post_id: postId, choice: 'just_right' });
    expect(current()).toEqual({ choice: 'just_right' });
    if (cast.ok) expect(cast.value.votes.just_right).toBe(39);
  });

  it('changes an existing vote with one update and no insert', async () => {
    const { repo, calls, current } = votesClient({ choice: 'too_high' });
    const changed = await repo.setVote('retro-windbreaker', 'too_low');
    expect(changed.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['update']);
    expect(calls[0]?.payload).toEqual({ choice: 'too_low' });
    expect(calls[0]?.filters).toEqual([['post_id', postId]]);
    expect(current()).toEqual({ choice: 'too_low' });
  });

  it('never upserts and never sends user_id', async () => {
    const { repo, calls } = votesClient(null);
    await repo.setVote('retro-windbreaker', 'too_high');
    await repo.setVote('retro-windbreaker', 'too_low');
    expect(calls.some((call) => call.op === 'upsert')).toBe(false);
    for (const call of calls) expect(call.payload ?? {}).not.toHaveProperty('user_id');
  });

  it('changes the vote another tab just added instead of failing', async () => {
    const { repo, calls, current } = votesClient(null, '23505');
    const cast = await repo.setVote('retro-windbreaker', 'just_right');
    expect(cast.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['update', 'insert', 'update']);
    expect(current()).toEqual({ choice: 'just_right' });
  });

  it('returns the database error when a vote is refused', async () => {
    const { repo } = votesClient(null, '42501');
    const cast = await repo.setVote('retro-windbreaker', 'just_right');
    expect(cast).toEqual({
      ok: false,
      error: { kind: 'authorization', code: 'not_found_or_denied' },
    });
  });

  it('withdraws a vote with a delete and returns the updated tallies', async () => {
    const { repo, calls, current } = votesClient({ choice: 'too_high' });
    const withdrawn = await repo.setVote('retro-windbreaker', null);
    expect(withdrawn.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['delete']);
    expect(current()).toBeNull();
  });
});
