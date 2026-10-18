import { ModerationUnavailable, type ModerationProvider } from '../_shared/providers/moderation.ts';

export type ModerationStatus = 'pending' | 'approved' | 'held' | 'removed';

/** The slice of the database moderation needs; the function wires it to Supabase. */
export interface CommentStore {
  get(id: string): Promise<{ readonly body: string; readonly status: ModerationStatus } | null>;
  settle(id: string, status: 'approved' | 'held', ref: string): Promise<void>;
}

export type Outcome =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'settled'; readonly status: ModerationStatus }
  | { readonly kind: 'retry_later' };

/**
 * Screens one pending comment. Fail-closed throughout: with no provider configured the comment
 * is held for a person to review, and if the provider is temporarily down it stays pending
 * (still invisible to everyone but its author) so a later call can finish the job. Comments that
 * were already decided are left alone, so calling this twice is harmless.
 */
export async function moderateComment(
  store: CommentStore,
  provider: ModerationProvider | null,
  commentId: string,
  signal?: AbortSignal,
): Promise<Outcome> {
  const comment = await store.get(commentId);
  if (!comment) return { kind: 'not_found' };
  if (comment.status !== 'pending') return { kind: 'settled', status: comment.status };

  if (!provider) {
    await store.settle(commentId, 'held', 'no-provider-configured');
    return { kind: 'settled', status: 'held' };
  }

  try {
    const verdict = await provider.screen(comment.body, signal);
    const ref = verdict.decision === 'held' ? `${verdict.ref} (${verdict.reason})` : verdict.ref;
    await store.settle(commentId, verdict.decision, ref);
    return { kind: 'settled', status: verdict.decision };
  } catch (error) {
    if (error instanceof ModerationUnavailable) return { kind: 'retry_later' };
    // Anything unexpected (a rejected request, a bug): hold for review rather than publish.
    await store.settle(commentId, 'held', `error: ${(error as Error).message}`.slice(0, 200));
    return { kind: 'settled', status: 'held' };
  }
}
