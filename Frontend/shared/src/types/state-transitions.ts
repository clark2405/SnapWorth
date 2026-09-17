import type { UtcDateTime } from './date-time';
import type { AppError } from './errors';
import type {
  EstimateFailureCode,
  EstimationState,
  ListingStatus,
  MessageDeliveryState,
  ModerationStatus,
} from './entities';
import type { AiEstimate } from './money';
import { err, ok, type Result } from './result';

export type EstimationEvent =
  | {
      readonly type: 'complete';
      readonly attempt: number;
      readonly estimate: AiEstimate;
      readonly completedAt: UtcDateTime;
    }
  | {
      readonly type: 'fail';
      readonly attempt: number;
      readonly code: EstimateFailureCode;
      readonly retryable: boolean;
    }
  | { readonly type: 'queue_offline'; readonly attempt: number }
  | { readonly type: 'retry'; readonly startedAt: UtcDateTime };

const transitionConflict = (code: string): AppError => ({
  kind: 'conflict',
  code,
  retryable: false,
});

export const createInitialEstimationState = (
  attempt: number,
  startedAt: UtcDateTime,
): Result<EstimationState, AppError> => {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    return err({ kind: 'validation', code: 'invalid_estimate_attempt', field: 'attempt' });
  }

  return ok({ status: 'estimating', attempt, startedAt });
};

export const transitionEstimation = (
  current: EstimationState,
  event: EstimationEvent,
): Result<EstimationState, AppError> => {
  if (event.type === 'retry') {
    const canRetry =
      current.status === 'queued_offline' ||
      (current.status === 'failed' && current.retryable);
    if (!canRetry) return err(transitionConflict('estimate_not_retryable'));
    return ok({ status: 'estimating', attempt: current.attempt + 1, startedAt: event.startedAt });
  }

  if (current.status !== 'estimating') {
    return err(transitionConflict('estimate_not_in_progress'));
  }
  if (event.attempt !== current.attempt) {
    return err(transitionConflict('stale_estimate_attempt'));
  }

  if (event.type === 'complete') {
    return ok({
      status: 'estimated',
      attempt: current.attempt,
      estimate: event.estimate,
      completedAt: event.completedAt,
    });
  }
  if (event.type === 'fail') {
    return ok({
      status: 'failed',
      attempt: current.attempt,
      code: event.code,
      retryable: event.retryable,
    });
  }
  return ok({ status: 'queued_offline', attempt: current.attempt });
};

export const transitionModeration = (
  current: ModerationStatus,
  next: 'approved' | 'held',
): Result<ModerationStatus, AppError> => {
  if (current !== 'pending') return err(transitionConflict('moderation_already_resolved'));
  return ok(next);
};

export const withdrawPublication = (
  current: 'published' | 'withdrawn',
): 'withdrawn' => (current === 'withdrawn' ? current : 'withdrawn');

export const transitionListingStatus = (
  current: ListingStatus,
  next: ListingStatus,
): Result<ListingStatus, AppError> => {
  if (current === next) return ok(current);

  const allowed =
    (current === 'held' && (next === 'active' || next === 'withdrawn')) ||
    (current === 'active' && (next === 'sold' || next === 'withdrawn'));

  return allowed ? ok(next) : err(transitionConflict('invalid_listing_transition'));
};

export const transitionMessageDelivery = (
  current: MessageDeliveryState,
  next:
    | { readonly status: 'pending' }
    | { readonly status: 'delivered'; readonly deliveredAt: UtcDateTime }
    | { readonly status: 'failed'; readonly error: AppError; readonly retryable: boolean },
): Result<MessageDeliveryState, AppError> => {
  const allowed =
    (current.status === 'pending' && (next.status === 'delivered' || next.status === 'failed')) ||
    (current.status === 'failed' && current.retryable && next.status === 'pending');

  return allowed ? ok(next) : err(transitionConflict('invalid_message_delivery_transition'));
};
