import type { UtcDateTime } from '../../types/date-time';
import type { CommentBody, ThreadComment } from '../../types/entities';
import type { CommentId, UserId } from '../../types/ids';
import { groupThread, relativeTime } from './comment-thread-model';

const comment = (id: string, createdAt: string, parentId: string | null = null): ThreadComment => ({
  id: id as CommentId,
  parentId: parentId as CommentId | null,
  parentHidden: false,
  body: id as CommentBody,
  moderationStatus: 'approved',
  createdAt: createdAt as UtcDateTime,
  author: { userId: 'u' as UserId, handle: 'u' },
  isMine: false,
  reportedByMe: false,
});

describe('groupThread', () => {
  it('puts the newest conversation first and replies in the order they were written', () => {
    const groups = groupThread([
      comment('reply-late', '2026-10-01T10:30:00.000Z', 'old'),
      comment('new', '2026-10-01T11:00:00.000Z'),
      comment('reply-early', '2026-10-01T10:10:00.000Z', 'old'),
      comment('old', '2026-10-01T10:00:00.000Z'),
    ]);
    expect(groups.map((group) => group.id)).toEqual(['new', 'old']);
    expect(groups[1]?.replies.map((reply) => reply.id)).toEqual(['reply-early', 'reply-late']);
  });

  it('keeps replies whose parent is gone under a placeholder', () => {
    const groups = groupThread([comment('orphan', '2026-10-01T10:00:00.000Z', 'gone')]);
    expect(groups).toEqual([
      expect.objectContaining({ id: 'gone', comment: null, replies: [expect.anything()] }),
    ]);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  it.each([
    ['2026-10-05T11:59:40.000Z', 'Just now'],
    ['2026-10-05T11:55:00.000Z', '5m ago'],
    ['2026-10-05T09:00:00.000Z', '3h ago'],
    ['2026-10-03T12:00:00.000Z', '2d ago'],
  ])('%s reads as %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
