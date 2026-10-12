import type { CommentBody, ModerationStatus, ReportReason, ThreadComment } from '../types/entities';
import type { AppError, ModerationError } from '../types/errors';
import type { CommentId } from '../types/ids';
import type { Result } from '../types/result';

/** Where a new comment goes: a post, and optionally the comment it answers. */
export interface NewComment {
  readonly postKey: string;
  readonly body: CommentBody;
  readonly replyTo?: CommentId;
}

/**
 * Storage for a post's discussion. Implementations decide who the viewer is and enforce what
 * they may see; the Supabase one leaves that to row-level security.
 */
export interface CommentRepository {
  listThread(postKey: string): Promise<Result<readonly ThreadComment[], AppError>>;
  /** Stores the comment as pending moderation and returns it as its author sees it. */
  insert(comment: NewComment): Promise<Result<ThreadComment, ModerationError>>;
  /**
   * Asks moderation to screen a pending comment. `pending` means it could not decide yet (for
   * example the provider is down); the comment simply stays private to its author.
   */
  moderate(commentId: CommentId): Promise<Result<ModerationStatus, AppError>>;
  softDelete(commentId: CommentId): Promise<Result<void, AppError>>;
  report(commentId: CommentId, reason: ReportReason): Promise<Result<void, AppError>>;
}
