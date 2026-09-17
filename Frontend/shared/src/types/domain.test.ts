import { parseUtcDateTime, utcDateTimeFromDate } from './date-time';
import { parseEmailAddress } from './identity';
import { parseEntityId, parseIdempotencyKey } from './ids';
import {
  confirmAskingPrice,
  createAskingPriceDraft,
  MAX_ASKING_PRICE_CENTS,
  normalizeAiEstimate,
} from './money';
import { parseCursor } from './pagination';
import { err, isErr, isOk, ok } from './result';
import {
  createInitialEstimationState,
  transitionEstimation,
  transitionListingStatus,
  transitionMessageDelivery,
  transitionModeration,
  withdrawPublication,
} from './state-transitions';

const uuid = '018f47a2-9b6c-7def-8abc-1234567890ab';

const unwrap = <T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T => {
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result.error)}`);
  return result.value;
};

describe('domain value objects', () => {
  it('creates typed results and narrows success and failure values', () => {
    const success = ok(42);
    const failure = err({ code: 'failed' });

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
  });

  it('accepts UUID entity IDs and rejects malformed values', () => {
    expect(unwrap(parseEntityId('item', uuid))).toBe(uuid);
    expect(parseEntityId('item', 'not-an-id')).toEqual({
      ok: false,
      error: { kind: 'validation', code: 'invalid_id', field: 'itemId' },
    });
  });

  it('validates opaque idempotency keys and pagination cursors', () => {
    expect(unwrap(parseIdempotencyKey('request_123456789'))).toBe('request_123456789');
    expect(parseIdempotencyKey('short').ok).toBe(false);
    expect(unwrap(parseCursor('publishedAt_abc123'))).toBe('publishedAt_abc123');
    expect(parseCursor('cursor with spaces').ok).toBe(false);
  });

  it('normalizes email addresses without accepting malformed input', () => {
    expect(unwrap(parseEmailAddress(' Person@Example.COM '))).toBe('person@example.com');
    expect(parseEmailAddress('missing-domain').ok).toBe(false);
  });

  it('requires UTC timestamps and canonicalizes valid values', () => {
    expect(unwrap(parseUtcDateTime('2025-01-02T03:04:05Z'))).toBe(
      '2025-01-02T03:04:05.000Z',
    );
    expect(parseUtcDateTime('2025-01-02T03:04:05+01:00').ok).toBe(false);
    expect(unwrap(utcDateTimeFromDate(new Date('2025-01-02T03:04:05Z')))).toBe(
      '2025-01-02T03:04:05.000Z',
    );
    expect(utcDateTimeFromDate(new Date(Number.NaN)).ok).toBe(false);
  });

  it('constructs normalized AI estimates without creating asking prices', () => {
    const estimate = unwrap(
      normalizeAiEstimate({
        amountCents: 12_345,
        providerRef: 'pricing-request-1',
        confidence: { lowerCents: 10_000, upperCents: 15_000 },
      }),
    );

    expect(estimate).toEqual({
      amount: 12_345,
      currency: 'USD',
      providerRef: 'pricing-request-1',
      confidence: { lower: 10_000, upper: 15_000 },
    });
    expect(normalizeAiEstimate({ amountCents: -1, providerRef: 'x' }).ok).toBe(false);
    expect(
      normalizeAiEstimate({
        amountCents: 12_345,
        providerRef: 'x',
        confidence: { lowerCents: 13_000, upperCents: 15_000 },
      }).ok,
    ).toBe(false);
  });

  it('creates asking prices only from non-empty user input and positive bounded cents', () => {
    const userId = unwrap(parseEntityId('user', uuid));
    const confirmedAt = unwrap(parseUtcDateTime('2025-01-02T03:04:05Z'));
    const draft = unwrap(createAskingPriceDraft('123.45', 12_345));

    expect(confirmAskingPrice(draft, userId, confirmedAt)).toEqual({
      amount: 12_345,
      currency: 'USD',
      confirmedBy: uuid,
      confirmedAt: '2025-01-02T03:04:05.000Z',
    });
    expect(createAskingPriceDraft('', 12_345).ok).toBe(false);
    expect(createAskingPriceDraft('0', 0).ok).toBe(false);
    expect(createAskingPriceDraft('too much', MAX_ASKING_PRICE_CENTS + 1).ok).toBe(false);
  });
});

describe('domain state transitions', () => {
  const startedAt = unwrap(parseUtcDateTime('2025-01-02T03:04:05Z'));
  const completedAt = unwrap(parseUtcDateTime('2025-01-02T03:04:06Z'));
  const estimate = unwrap(normalizeAiEstimate({ amountCents: 500, providerRef: 'request-1' }));

  it('accepts current estimate completion and rejects stale responses', () => {
    const estimating = unwrap(createInitialEstimationState(2, startedAt));
    const completed = transitionEstimation(estimating, {
      type: 'complete',
      attempt: 2,
      estimate,
      completedAt,
    });
    const stale = transitionEstimation(estimating, {
      type: 'complete',
      attempt: 1,
      estimate,
      completedAt,
    });

    expect(unwrap(completed)).toMatchObject({ status: 'estimated', attempt: 2, estimate });
    expect(stale).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'stale_estimate_attempt', retryable: false },
    });
  });

  it('preserves the attempt on failure/offline and increments only a valid retry', () => {
    const estimating = unwrap(createInitialEstimationState(1, startedAt));
    const failed = unwrap(
      transitionEstimation(estimating, {
        type: 'fail',
        attempt: 1,
        code: 'timeout',
        retryable: true,
      }),
    );
    const retried = unwrap(transitionEstimation(failed, { type: 'retry', startedAt: completedAt }));
    const queued = unwrap(
      transitionEstimation(estimating, { type: 'queue_offline', attempt: 1 }),
    );

    expect(failed).toEqual({ status: 'failed', attempt: 1, code: 'timeout', retryable: true });
    expect(retried).toEqual({ status: 'estimating', attempt: 2, startedAt: completedAt });
    expect(queued).toEqual({ status: 'queued_offline', attempt: 1 });
    expect(transitionEstimation(retried, { type: 'retry', startedAt }).ok).toBe(false);
  });

  it('rejects invalid initial estimate attempts', () => {
    expect(createInitialEstimationState(0, startedAt).ok).toBe(false);
    expect(createInitialEstimationState(1.5, startedAt).ok).toBe(false);
  });

  it('allows only pending moderation to resolve', () => {
    expect(transitionModeration('pending', 'approved')).toEqual({ ok: true, value: 'approved' });
    expect(transitionModeration('held', 'approved').ok).toBe(false);
  });

  it('withdraws publication idempotently and enforces listing status transitions', () => {
    expect(withdrawPublication('published')).toBe('withdrawn');
    expect(withdrawPublication('withdrawn')).toBe('withdrawn');
    expect(transitionListingStatus('active', 'sold')).toEqual({ ok: true, value: 'sold' });
    expect(transitionListingStatus('sold', 'active').ok).toBe(false);
  });

  it('allows message confirmation/failure and retry but no delivered rollback', () => {
    const delivered = transitionMessageDelivery(
      { status: 'pending' },
      { status: 'delivered', deliveredAt: completedAt },
    );
    const failureError = {
      kind: 'offline' as const,
      operation: 'send_message' as const,
      retryable: true as const,
    };
    const failed = unwrap(
      transitionMessageDelivery(
        { status: 'pending' },
        { status: 'failed', error: failureError, retryable: true },
      ),
    );

    expect(delivered.ok).toBe(true);
    expect(transitionMessageDelivery(failed, { status: 'pending' }).ok).toBe(true);
    expect(
      transitionMessageDelivery(
        { status: 'delivered', deliveredAt: completedAt },
        { status: 'pending' },
      ).ok,
    ).toBe(false);
  });
});
