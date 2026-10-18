import type { CommentRepository } from '../ports/comments';
import type { CommentService } from '../ports/services';
import { parseCommentBody } from '../types/entities';
import type { CommentReceipt, ReportReason } from '../types/entities';
import type { ModerationError } from '../types/errors';
import type { CommentId } from '../types/ids';
import { err, ok, type Result } from '../types/result';

/**
 * The feed discussion's rules on top of any storage: a comment is validated before it is
 * stored, and every new comment is put through moderation before the poster is told how it
 * landed. Moderation failing to decide is not an error for the poster: the comment is kept,
 * stays private to them as `pending`, and the screen says so.
 */
export function createCommentService(repository: CommentRepository): CommentService {
  return {
    listThread: (postKey) => repository.listThread(postKey),

    async submit(postKey, rawBody, replyTo): Promise<Result<CommentReceipt, ModerationError>> {
      const body = parseCommentBody(rawBody);
      if (!body.ok) return err(body.error);

      const stored = await repository.insert({ postKey, body: body.value, replyTo });
      if (!stored.ok) return stored;

      const verdict = await repository.moderate(stored.value.id);
      const moderationStatus = verdict.ok ? verdict.value : stored.value.moderationStatus;
      return ok({ comment: { ...stored.value, moderationStatus } });
    },

    remove: (commentId: CommentId) => repository.softDelete(commentId),

    report: (commentId: CommentId, reason: ReportReason) => repository.report(commentId, reason),
  };
}
