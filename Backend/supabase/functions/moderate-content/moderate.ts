import { ModerationUnavailable, type ModerationProvider } from '../_shared/providers/moderation.ts';

export type ModerationStatus = 'pending' | 'approved' | 'held' | 'removed';

/** The slice of the database moderation needs; the function wires it to Supabase. */
export interface CommentStore {
  get(id: string): Promise<{ readonly body: string; readonly status: ModerationStatus } | null>;
  settle(id: string, status: 'approved' | 'held' | 'removed', ref: string): Promise<void>;
}

export type Outcome =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'settled'; readonly status: ModerationStatus }
  | { readonly kind: 'retry_later' };

/**
 * Screens one pending item. Fail-closed throughout: with no provider configured the item is
 * held for a person to review, and if the provider is temporarily down it stays pending
 * (still invisible to everyone but its author) so a later call can finish the job. Items that
 * were already decided are left alone, so calling this twice is harmless.
 */
export async function moderateComment(
  store: CommentStore,
  provider: ModerationProvider | null,
  commentId: string,
  signal?: AbortSignal,
  options?: { readonly allowAutoRemove?: boolean },
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
    const decision =
      verdict.decision === 'removed' && options?.allowAutoRemove === false ? 'held' : verdict.decision;
    const ref =
      verdict.decision === 'approved' ? verdict.ref : `${verdict.ref} (${verdict.reason})`;
    await store.settle(commentId, decision, ref);
    return { kind: 'settled', status: decision };
  } catch (error) {
    if (error instanceof ModerationUnavailable) return { kind: 'retry_later' };
    // Anything unexpected (a rejected request, a bug): hold for review rather than publish.
    await store.settle(commentId, 'held', `error: ${(error as Error).message}`.slice(0, 200));
    return { kind: 'settled', status: 'held' };
  }
}
