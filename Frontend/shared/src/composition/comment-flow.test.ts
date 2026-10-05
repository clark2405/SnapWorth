import {
  createLocalCommentRepository,
  screenWithRules,
  type KeyValueStore,
  type LocalSeedComment,
} from '../adapters';
import { createCommentService } from '../services';
import type { UtcDateTime } from '../types/date-time';
import type { PublicProfile } from '../types/entities';
import type { CommentId, UserId } from '../types/ids';

const person = (handle: string): PublicProfile => ({
  userId: `test:${handle}` as UserId,
  handle,
});
const ana = person('ana');
const ben = person('ben');

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

const seed: LocalSeedComment[] = [
  {
    id: 'seed-1',
    postKey: 'jacket',
    parentId: null,
    body: 'Fair price.',
    author: ben,
    createdAt: '2026-10-01T10:00:00.000Z' as UtcDateTime,
  },
];

function serviceFor(viewer: PublicProfile, store = memoryStore()) {
  return createCommentService(
    createLocalCommentRepository({ store, viewer, seed, screen: screenWithRules }),
  );
}

async function threadIds(service: ReturnType<typeof serviceFor>, postKey = 'jacket') {
  const result = await service.listThread(postKey);
  if (!result.ok) throw new Error('thread failed to load');
  return result.value;
}

describe('posting comments', () => {
  it('trims, stores and approves a clean comment, newest first', async () => {
    const service = serviceFor(ana);
    const result = await service.submit('jacket', '  Looks great.  ');
    expect(result.ok && result.value.comment).toMatchObject({
      body: 'Looks great.',
      moderationStatus: 'approved',
      isMine: true,
      parentId: null,
    });
    const thread = await threadIds(service);
    expect(thread.map((comment) => comment.body)).toEqual(['Looks great.', 'Fair price.']);
  });

  it('holds a comment that tries to take the sale off-platform', async () => {
    const result = await serviceFor(ana).submit('jacket', 'DM me for a better price');
    expect(result.ok && result.value.comment.moderationStatus).toBe('held');
  });

  it('rejects an empty or overlong comment without storing anything', async () => {
    const service = serviceFor(ana);
    expect(await service.submit('jacket', '   ')).toEqual({
      ok: false,
      error: { kind: 'validation', code: 'empty', field: 'comment' },
    });
    const long = await service.submit('jacket', 'x'.repeat(281));
    expect(!long.ok && long.error).toMatchObject({ code: 'too_long', limit: '280' });
    expect(await threadIds(service)).toHaveLength(1);
  });

  it('keeps comments across restarts of the app', async () => {
    const store = memoryStore();
    await serviceFor(ana, store).submit('jacket', 'Still here after a restart?');
    const thread = await threadIds(serviceFor(ana, store));
    expect(thread.some((comment) => comment.body === 'Still here after a restart?')).toBe(true);
  });
});

describe('replies', () => {
  it('attaches a reply to its comment, and a reply to a reply to the same thread', async () => {
    const service = serviceFor(ana);
    const first = await service.submit('jacket', 'Agreed.', 'seed-1' as CommentId);
    if (!first.ok) throw new Error('reply failed');
    expect(first.value.comment.parentId).toBe('seed-1');
    const second = await service.submit('jacket', 'Me too.', first.value.comment.id);
    expect(second.ok && second.value.comment.parentId).toBe('seed-1');
  });

  it('cannot answer a comment the viewer cannot see', async () => {
    const store = memoryStore();
    const held = await serviceFor(ben, store).submit('jacket', 'Call 0917 123 4567');
    if (!held.ok) throw new Error('setup failed');
    const reply = await serviceFor(ana, store).submit('jacket', 'Hm', held.value.comment.id);
    expect(!reply.ok && reply.error.kind).toBe('authorization');
  });
});

describe('deleting and reporting', () => {
  it('deletes only your own comment, leaving replies under a placeholder', async () => {
    const store = memoryStore();
    const own = await serviceFor(ana, store).submit('jacket', 'My take.');
    if (!own.ok) throw new Error('setup failed');
    await serviceFor(ben, store).submit('jacket', 'Reply to Ana', own.value.comment.id);

    const byOther = await serviceFor(ben, store).remove(own.value.comment.id);
    expect(!byOther.ok && byOther.error.kind).toBe('authorization');

    expect((await serviceFor(ana, store).remove(own.value.comment.id)).ok).toBe(true);
    const thread = await threadIds(serviceFor(ben, store));
    expect(thread.find((comment) => comment.id === own.value.comment.id)).toBeUndefined();
    expect(thread.find((comment) => comment.body === 'Reply to Ana')?.parentHidden).toBe(true);
  });

  it('reports others only, once each, and holds a comment after three reports', async () => {
    const store = memoryStore();
    expect((await serviceFor(ben, store).report('seed-1' as CommentId, 'spam')).ok).toBe(false);
    for (const reporter of [ana, person('cy'), person('dee')]) {
      const service = serviceFor(reporter, store);
      expect((await service.report('seed-1' as CommentId, 'spam')).ok).toBe(true);
      expect((await service.report('seed-1' as CommentId, 'spam')).ok).toBe(true);
    }
    expect(await threadIds(serviceFor(ana, store))).toHaveLength(0);
    const own = await threadIds(serviceFor(ben, store));
    expect(own[0]?.moderationStatus).toBe('held');
  });
});
