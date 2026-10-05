import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommentRepository } from '../../ports/comments';
import type { CommentBody, ModerationStatus, ThreadComment } from '../../types/entities';
import type { ModerationError } from '../../types/errors';
import type { CommentId, UserId } from '../../types/ids';
import { err, ok, type Result } from '../../types/result';
import type { UtcDateTime } from '../../types/date-time';
import { toAppError } from './errors';

interface ThreadRow {
  readonly id: string;
  readonly parent_id: string | null;
  readonly parent_hidden: boolean;
  readonly body: string;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly author_id: string;
  readonly author_handle: string;
  readonly author_avatar_url: string | null;
  readonly is_mine: boolean;
  readonly reported_by_me: boolean;
}

function fromRow(row: ThreadRow): ThreadComment {
  return {
    id: row.id as CommentId,
    parentId: (row.parent_id as CommentId | null) ?? null,
    parentHidden: row.parent_hidden,
    body: row.body as CommentBody,
    moderationStatus: row.moderation_status,
    createdAt: new Date(row.created_at).toISOString() as UtcDateTime,
    author: {
      userId: row.author_id as UserId,
      handle: row.author_handle,
      avatarUrl: row.author_avatar_url ?? undefined,
    },
    isMine: row.is_mine,
    reportedByMe: row.reported_by_me,
  };
}

/**
 * Comments stored in Supabase. Who may see or change what is decided by the database's
 * row-level security; this adapter only translates. Until email sign-in is wired up, a device
 * without a session signs in anonymously so its comments have an author.
 */
export function createSupabaseCommentRepository(client: SupabaseClient): CommentRepository {
  async function ensureSession(): Promise<Result<void, ModerationError>> {
    const { data } = await client.auth.getSession();
    if (data.session) return ok(undefined);
    const { error } = await client.auth.signInAnonymously();
    return error ? err(toAppError(error, 'authenticate')) : ok(undefined);
  }

  return {
    async listThread(postKey) {
      const { data, error } = await client.rpc('comment_thread', { post_slug: postKey });
      if (error) return err(toAppError(error, 'load_post'));
      return ok((data as ThreadRow[]).map(fromRow));
    },

    async insert({ postKey, body, replyTo }) {
      const session = await ensureSession();
      if (!session.ok) return err(session.error);

      const post = await client.from('feed_posts').select('id').eq('slug', postKey).single();
      if (post.error) return err(toAppError(post.error, 'submit_comment'));

      const { data, error } = await client
        .from('comments')
        .insert({ post_id: post.data.id, parent_id: replyTo ?? null, body })
        .select(
          'id, parent_id, body, moderation_status, created_at, author_id, author:profiles(handle, avatar_url)',
        )
        .single();
      if (error) return err(toAppError(error, 'submit_comment'));

      const author = (Array.isArray(data.author) ? data.author[0] : data.author) as
        { handle: string; avatar_url: string | null } | undefined;
      return ok(
        fromRow({
          ...data,
          parent_hidden: false,
          author_handle: author?.handle ?? 'you',
          author_avatar_url: author?.avatar_url ?? null,
          is_mine: true,
          reported_by_me: false,
        } as ThreadRow),
      );
    },

    async moderate(commentId) {
      const { data, error } = await client.functions.invoke<{ status?: ModerationStatus }>(
        'moderate-content',
        { body: { type: 'comment', id: commentId } },
      );
      // A 503 means the provider could not decide yet; the comment stays pending, privately.
      if (error) return err(toAppError(error, 'submit_comment'));
      return ok(data?.status ?? 'pending');
    },

    async softDelete(commentId) {
      const { data, error } = await client.rpc('delete_own_comment', { target: commentId });
      if (error) return err(toAppError(error, 'delete_comment'));
      return data === true
        ? ok(undefined)
        : err({ kind: 'authorization', code: 'not_found_or_denied' });
    },

    async report(commentId, reason) {
      const session = await ensureSession();
      if (!session.ok) return err(session.error);
      const { error } = await client
        .from('comment_reports')
        .insert({ comment_id: commentId, reason });
      // Reporting twice is not a failure from the reporter's point of view, including when an
      // earlier report has already helped hold the comment (and so hidden it from them).
      if (!error || error.code === '23505') return ok(undefined);
      const earlier = await client
        .from('comment_reports')
        .select('id')
        .eq('comment_id', commentId)
        .maybeSingle();
      return earlier.data ? ok(undefined) : err(toAppError(error, 'report_content'));
    },
  };
}
