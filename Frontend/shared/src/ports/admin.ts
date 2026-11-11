import type { UtcDateTime } from '../types/date-time';
import type { ModerationStatus } from '../types/entities';
import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

/** What can land in the review queue. Listings join once they have moderation columns. */
export type ReviewKind = 'comment' | 'post' | 'hanap' | 'conversation';

/**
 * What an admin can decide about a case. Approve makes content public; hold hides it for a closer
 * look; remove takes it down; dismiss closes its reports and leaves it as it is.
 */
export type ReviewDecision = 'approve' | 'hold' | 'remove' | 'dismiss';

/** One thing to look at: content moderation held, or something people reported. */
export interface ReviewCase {
  /** `kind:targetId`, unique across the queue. */
  readonly id: string;
  readonly kind: ReviewKind;
  readonly targetId: string;
  /** Where moderation has got to; a conversation has none. */
  readonly status: ModerationStatus | null;
  /** The text itself. A conversation's messages are private, so it has none. */
  readonly body: string;
  /** Who wrote it, or for a conversation who the report is about. */
  readonly authorHandle: string;
  readonly authorAvatarUrl: string | null;
  /** Why moderation held it, as `moderate-content` recorded it. */
  readonly flagRef: string | null;
  /** Reports nobody has decided on yet. */
  readonly reportCount: number;
  readonly reportReasons: readonly string[];
  readonly flaggedAt: UtcDateTime;
  /** More about the case, when the text alone doesn't say. */
  readonly context: string | null;
}

/**
 * Where the review queue is read and decided: Supabase, or sample data on a device with no
 * project. Only an admin gets anything; anyone else is refused (an `authorization` error).
 */
export interface AdminRepository {
  /** Open cases, most reported first and then oldest. */
  queue(): Promise<Result<readonly ReviewCase[], AppError>>;
  decide(
    item: Pick<ReviewCase, 'kind' | 'targetId'>,
    decision: ReviewDecision,
  ): Promise<Result<void, AppError>>;
}
