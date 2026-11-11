import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReviewCase } from '../../ports/admin';
import type { UtcDateTime } from '../../types/date-time';
import { createLocalAdminRepository } from '../local/admin-repository';
import { createSupabaseAdminRepository } from './admin-repository';

const at = (hoursAgo: number) =>
  new Date(Date.UTC(2026, 10, 11, 12) - hoursAgo * 3_600_000).toISOString() as UtcDateTime;

const reviewCase = (
  over: Partial<ReviewCase> & Pick<ReviewCase, 'kind' | 'targetId'>,
): ReviewCase => ({
  id: `${over.kind}:${over.targetId}`,
  status: 'held',
  body: 'Some words',
  authorHandle: 'bo',
  authorAvatarUrl: null,
  flagRef: null,
  reportCount: 0,
  reportReasons: [],
  flaggedAt: at(1),
  context: null,
  ...over,
});

describe('createLocalAdminRepository', () => {
  const seed = [
    reviewCase({ kind: 'hanap', targetId: 'h1', flaggedAt: at(1) }),
    reviewCase({ kind: 'comment', targetId: 'c1', flaggedAt: at(5) }),
    reviewCase({
      kind: 'comment',
      targetId: 'c2',
      status: 'approved',
      reportCount: 2,
      reportReasons: ['spam'],
      flaggedAt: at(3),
    }),
    reviewCase({
      kind: 'conversation',
      targetId: 'v1',
      status: null,
      body: '',
      reportCount: 1,
      reportReasons: ['scam'],
    }),
  ];
  const queued = async (repo: ReturnType<typeof createLocalAdminRepository>) => {
    const result = await repo.queue();
    return result.ok ? result.value.map((entry) => entry.id) : [];
  };

  it('lists the most reported first, then the oldest', async () => {
    const repo = createLocalAdminRepository({ seed });

    expect(await queued(repo)).toEqual(['comment:c2', 'conversation:v1', 'comment:c1', 'hanap:h1']);
  });

  it('takes approved and removed cases out of the queue', async () => {
    const repo = createLocalAdminRepository({ seed });

    expect((await repo.decide({ kind: 'comment', targetId: 'c1' }, 'approve')).ok).toBe(true);
    expect((await repo.decide({ kind: 'hanap', targetId: 'h1' }, 'remove')).ok).toBe(true);

    expect(await queued(repo)).toEqual(['comment:c2', 'conversation:v1']);
  });

  it('holds an approved case but keeps its reports open', async () => {
    const repo = createLocalAdminRepository({ seed });

    await repo.decide({ kind: 'comment', targetId: 'c2' }, 'hold');
    const result = await repo.queue();

    const held = result.ok ? result.value.find((entry) => entry.targetId === 'c2') : undefined;
    expect(held?.status).toBe('held');
    expect(held?.reportCount).toBe(2);
  });

  it('dismisses reports: an approved case is done, a held one stays to be looked at', async () => {
    const repo = createLocalAdminRepository({
      seed: [
        ...seed,
        reviewCase({ kind: 'post', targetId: 'p1', reportCount: 1, reportReasons: ['spam'] }),
      ],
    });

    await repo.decide({ kind: 'comment', targetId: 'c2' }, 'dismiss');
    await repo.decide({ kind: 'post', targetId: 'p1' }, 'dismiss');
    const result = await repo.queue();

    const ids = result.ok ? result.value.map((entry) => entry.id) : [];
    expect(ids).not.toContain('comment:c2');
    expect(ids).toContain('post:p1');
    const stays = result.ok ? result.value.find((entry) => entry.targetId === 'p1') : undefined;
    expect(stays?.reportCount).toBe(0);
  });

  it('keeps the server’s rules: nothing to dismiss, and a conversation is only dismissed', async () => {
    const repo = createLocalAdminRepository({ seed });

    const nothing = await repo.decide({ kind: 'comment', targetId: 'c1' }, 'dismiss');
    const removing = await repo.decide({ kind: 'conversation', targetId: 'v1' }, 'remove');
    const unknown = await repo.decide({ kind: 'comment', targetId: 'nope' }, 'remove');

    expect(nothing.ok).toBe(false);
    expect(removing.ok).toBe(false);
    expect(unknown).toEqual({
      ok: false,
      error: { kind: 'authorization', code: 'not_found_or_denied' },
    });
  });
});

describe('createSupabaseAdminRepository', () => {
  const clientAnswering = (result: { data?: unknown; error?: unknown }) => {
    const rpc = jest.fn(() => Promise.resolve({ data: null, error: null, ...result }));
    return { client: { rpc } as unknown as SupabaseClient, rpc };
  };

  it('reads the queue through the admin function and maps each row', async () => {
    const { client, rpc } = clientAnswering({
      data: [
        {
          kind: 'comment',
          target_id: 'c-1',
          status: 'held',
          body: 'Scam!',
          author_handle: 'bo',
          author_avatar_url: null,
          flag_ref: 'rules (scam accusation)',
          report_count: 2,
          report_reasons: ['spam', 'harassment'],
          flagged_at: '2026-11-11T09:00:00.000Z',
          context: null,
        },
        {
          kind: 'conversation',
          target_id: 'v-1',
          status: null,
          body: '',
          author_handle: 'cy',
          author_avatar_url: 'https://example.com/a.jpg',
          flag_ref: null,
          report_count: 1,
          report_reasons: null,
          flagged_at: '2026-11-11T10:00:00.000Z',
          context: 'About "Brass lamp", reported by @fay',
        },
      ],
    });

    const result = await createSupabaseAdminRepository(client).queue();

    expect(rpc).toHaveBeenCalledWith('admin_review_queue');
    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 'comment:c-1',
          kind: 'comment',
          targetId: 'c-1',
          status: 'held',
          body: 'Scam!',
          authorHandle: 'bo',
          authorAvatarUrl: null,
          flagRef: 'rules (scam accusation)',
          reportCount: 2,
          reportReasons: ['spam', 'harassment'],
          flaggedAt: '2026-11-11T09:00:00.000Z',
          context: null,
        },
        expect.objectContaining({
          id: 'conversation:v-1',
          status: null,
          reportReasons: [],
          context: 'About "Brass lamp", reported by @fay',
        }),
      ],
    });
  });

  it('turns the database’s refusal of a non-admin into an authorization error', async () => {
    const { client } = clientAnswering({
      error: { code: '42501', message: 'Only admins can review content.' },
    });

    const result = await createSupabaseAdminRepository(client).queue();

    expect(result).toEqual({
      ok: false,
      error: { kind: 'authorization', code: 'not_found_or_denied' },
    });
  });

  it('sends a decision with the case’s kind and id', async () => {
    const { client, rpc } = clientAnswering({});

    const result = await createSupabaseAdminRepository(client).decide(
      { kind: 'hanap', targetId: 'h-9' },
      'remove',
    );

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('admin_review_decide', {
      item_kind: 'hanap',
      item_id: 'h-9',
      decision: 'remove',
    });
  });

  it('reports a decision the database refused', async () => {
    const refused = clientAnswering({ error: { code: '42501', message: 'Only admins' } });
    const gone = clientAnswering({ error: { code: 'P0002', message: 'not available' } });
    const nothing = clientAnswering({ error: { code: '22023', message: 'no open reports' } });
    const offline = clientAnswering({ error: new TypeError('Failed to fetch') });

    const decide = (c: { client: SupabaseClient }) =>
      createSupabaseAdminRepository(c.client).decide({ kind: 'comment', targetId: 'c' }, 'dismiss');

    expect(await decide(refused)).toMatchObject({ ok: false, error: { kind: 'authorization' } });
    expect(await decide(gone)).toMatchObject({ ok: false, error: { kind: 'authorization' } });
    expect(await decide(nothing)).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(await decide(offline)).toMatchObject({ ok: false, error: { kind: 'offline' } });
  });
});
