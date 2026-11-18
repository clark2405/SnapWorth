import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommentRepository } from '../../ports/comments';
import type { CommentBody, ModerationStatus, ThreadComment } from '../../types/entities';
import type { ModerationError } from '../../types/errors';
import type { CommentId, UserId } from '../../types/ids';
import { err, ok, type Result } from '../../types/result';
import type { UtcDateTime } from '../../types/date-time';
import { toAppError } from './errors';
import { requireSignedIn } from './session';

interface ThreadRow {
  readonly id: string;
  readonly parent_id: string | null;
  readonly parent_hidden: boolean;
  readonly body: string;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly author_id: string;
  readonly author_handle: string;
  readonly author_display_name?: string | null;
  readonly author_avatar_url: string | null;
  readonly is_mine: boolean;
  readonly reported_by_me: boolean;
}

function fromRow(row: ThreadRow): ThreadComment {
  const displayName = row.author_display_name?.trim();
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
      ...(displayName ? { displayName } : {}),
      avatarUrl: row.author_avatar_url ?? undefined,
    },
    isMine: row.is_mine,
    reportedByMe: row.reported_by_me,
  };
}

/**
 * Comments stored in Supabase. Who may see or change what is decided by the database's
 * row-level security; this adapter only translates. Reading needs no account; commenting and
 * reporting need a signed-in one.
 */
export function createSupabaseCommentRepository(client: SupabaseClient): CommentRepository {
  async function ensureSession(): Promise<Result<void, ModerationError>> {
    const signedIn = await requireSignedIn(client);
    return signedIn.ok ? ok(undefined) : signedIn;
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

      const { data, error } = await client.functions.invoke<{
        success?: boolean;
        data?: ThreadRow | ThreadRow[];
        error?: string;
        blocked?: boolean;
      }>('moderate-comment', {
        body: {
          text: body,
          postId: post.data.id,
          parentId: replyTo ?? null,
        },
      });

      if (error) {
        let message = String((error as { message?: string }).message ?? '');
        let isBlocked = false;

        const errorWithContext = error as { context?: { json?: () => Promise<unknown> } };
        if (typeof errorWithContext?.context?.json === 'function') {
          try {
            const body = await errorWithContext.context.json();
            if (body && typeof body === 'object') {
              const b = body as { error?: string; message?: string; blocked?: boolean };
              const errStr = b.error ?? b.message;
              if (errStr) message = String(errStr);
              if (b.blocked) isBlocked = true;
            }
          } catch {
            // ignore non-json error responses
          }
        }

        if (isBlocked || /violat|blocked|community guideline/i.test(message)) {
          return err({ kind: 'validation', code: 'blocked', field: 'comment' });
        }
        return err(toAppError(new Error(message || 'submit_comment failed'), 'submit_comment'));
      }

      if (data?.error) {
        if (data.blocked || /violat|blocked|community guideline/i.test(data.error)) {
          return err({ kind: 'validation', code: 'blocked', field: 'comment' });
        }
        return err({ kind: 'validation', code: 'rejected', field: 'comment' });
      }

      const commentData = data?.data ?? data;
      const row = (Array.isArray(commentData) ? commentData[0] : commentData) as
        | (ThreadRow & {
            readonly text?: string;
            readonly author?:
              | {
                  readonly handle?: string;
                  readonly display_name?: string | null;
                  readonly avatar_url?: string | null;
                }
              | readonly {
                  readonly handle?: string;
                  readonly display_name?: string | null;
                  readonly avatar_url?: string | null;
                }[];
          })
        | undefined;

      if (!row || !row.id) {
        return err(toAppError(new Error('Failed to create comment'), 'submit_comment'));
      }

      const author = Array.isArray(row.author) ? row.author[0] : row.author;
      return ok(
        fromRow({
          ...row,
          body: row.body ?? row.text ?? body,
          moderation_status: row.moderation_status ?? 'approved',
          parent_id: row.parent_id ?? replyTo ?? null,
          parent_hidden: false,
          author_id: row.author_id ?? '',
          author_handle: author?.handle ?? row.author_handle ?? 'you',
          author_display_name: author?.display_name ?? row.author_display_name ?? null,
          author_avatar_url: author?.avatar_url ?? row.author_avatar_url ?? null,
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
      // A 503 means the provider could not decide yet: the comment stays pending, privately.
      // Never call it approved here: the database still holds it, and nobody else would see it.
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
