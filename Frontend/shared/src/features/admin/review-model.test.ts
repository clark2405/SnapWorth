import type { ReviewCase } from '../../ports/admin';
import type { UtcDateTime } from '../../types/date-time';
import {
  ageLabel,
  decisionToast,
  flagReason,
  kindLabel,
  reviewActions,
  reviewErrorCopy,
} from './review-model';

const reviewCase = (over: Partial<ReviewCase> = {}): ReviewCase => ({
  id: 'comment:c1',
  kind: 'comment',
  targetId: 'c1',
  status: 'held',
  title: null,
  body: 'Words',
  photoUrl: null,
  authorHandle: 'bo',
  authorAvatarUrl: null,
  flagRef: null,
  reportCount: 0,
  reportReasons: [],
  flaggedAt: '2026-11-11T09:00:00.000Z' as UtcDateTime,
  context: null,
  ...over,
});

describe('reviewActions', () => {
  it('lets content that is not public yet be approved or removed', () => {
    expect(reviewActions(reviewCase({ status: 'held' }))).toEqual(['remove', 'approve']);
    expect(reviewActions(reviewCase({ status: 'pending' }))).toEqual(['remove', 'approve']);
  });

  it('lets reported public content be dismissed, held or removed', () => {
    expect(reviewActions(reviewCase({ status: 'approved', reportCount: 2 }))).toEqual([
      'remove',
      'hold',
      'dismiss',
    ]);
  });

  it('lets a listing that is held or never screened be approved or removed', () => {
    expect(reviewActions(reviewCase({ kind: 'listing', status: 'held' }))).toEqual([
      'remove',
      'approve',
    ]);
    expect(reviewActions(reviewCase({ kind: 'listing', status: 'pending' }))).toEqual([
      'remove',
      'approve',
    ]);
  });

  it('only lets a conversation’s reports be dismissed', () => {
    expect(reviewActions(reviewCase({ kind: 'conversation', status: null }))).toEqual(['dismiss']);
  });
});

describe('flagReason', () => {
  it('says why moderation held something, in words', () => {
    expect(flagReason(reviewCase({ flagRef: 'community-reports' }))).toBe(
      'Held after three reports',
    );
    expect(flagReason(reviewCase({ flagRef: 'rules (off-platform contact)' }))).toBe(
      'Flagged by the word rules: off-platform contact',
    );
    expect(flagReason(reviewCase({ flagRef: 'openai:modr-1 (harassment, hate)' }))).toBe(
      'Flagged by moderation: harassment, hate',
    );
    expect(flagReason(reviewCase({ flagRef: 'no-provider-configured' }))).toBe(
      'Held: no moderation provider is set up yet',
    );
    expect(flagReason(reviewCase({ flagRef: 'error: boom' }))).toBe(
      'Held: moderation hit an error',
    );
    expect(flagReason(reviewCase({ flagRef: 'admin:abc' }))).toBe('Held by an admin');
    expect(flagReason(reviewCase({ flagRef: null }))).toBe('Held for review');
  });

  it('says what people reported it for, once each', () => {
    expect(
      flagReason(
        reviewCase({
          status: 'approved',
          reportCount: 3,
          reportReasons: ['spam', 'prohibited_item', 'spam'],
        }),
      ),
    ).toBe('Reported for spam, prohibited item');
  });

  it('joins what moderation said with what people reported', () => {
    expect(
      flagReason(
        reviewCase({
          flagRef: 'community-reports',
          reportCount: 4,
          reportReasons: ['harassment'],
        }),
      ),
    ).toBe('Held after three reports · Reported for harassment');
  });

  it('flags content moderation never finished with', () => {
    expect(flagReason(reviewCase({ status: 'pending' }))).toBe('Moderation never finished');
  });

  it('describes a conversation by its reports alone', () => {
    expect(
      flagReason(
        reviewCase({
          kind: 'conversation',
          status: null,
          reportCount: 1,
          reportReasons: ['scam'],
        }),
      ),
    ).toBe('Reported for scam');
  });
});

describe('ageLabel', () => {
  const now = new Date('2026-11-11T12:00:00.000Z');

  it('reads as minutes, hours then days', () => {
    expect(ageLabel('2026-11-11T11:59:50.000Z', now)).toBe('just now');
    expect(ageLabel('2026-11-11T11:25:00.000Z', now)).toBe('35m ago');
    expect(ageLabel('2026-11-11T09:00:00.000Z', now)).toBe('3h ago');
    expect(ageLabel('2026-11-09T12:00:00.000Z', now)).toBe('2d ago');
  });
});

describe('copy', () => {
  it('names what was decided about whom', () => {
    expect(decisionToast(reviewCase(), 'approve')).toEqual({
      title: 'Approved',
      body: 'Comment by @bo is now public.',
    });
    expect(decisionToast(reviewCase({ kind: 'hanap' }), 'remove').body).toBe(
      'Hanap by @bo was removed.',
    );
    expect(decisionToast(reviewCase(), 'hold').title).toBe('Held');
    expect(decisionToast(reviewCase({ kind: 'conversation' }), 'dismiss').title).toBe(
      'Reports dismissed',
    );
    expect(kindLabel('post')).toBe('Feed post');
    expect(kindLabel('listing')).toBe('Listing');
  });

  it('says a removed listing closes its chats, and a listing is public once approved', () => {
    const listing = reviewCase({ kind: 'listing', title: 'Film camera' });

    expect(decisionToast(listing, 'remove')).toEqual({
      title: 'Removed',
      body: 'Listing by @bo was removed, and its chats are closed.',
    });
    expect(decisionToast(listing, 'approve').body).toBe('Listing by @bo is now public.');
    expect(decisionToast(listing, 'hold').body).toBe('Listing by @bo is hidden until you decide.');
  });

  it('explains a decision the database turned down', () => {
    expect(
      reviewErrorCopy({ kind: 'offline', operation: 'resolve_moderation_case', retryable: true })
        .title,
    ).toBe('Not saved');
    expect(reviewErrorCopy({ kind: 'authorization', code: 'not_found_or_denied' }).title).toBe(
      'That case is gone',
    );
    expect(reviewErrorCopy({ kind: 'validation', code: 'rejected' }).title).toBe(
      "That can't be done",
    );
    expect(reviewErrorCopy({ kind: 'unknown', requestId: 'x', retryable: true }).title).toBe(
      'Something went wrong',
    );
  });
});
