import type { ThreadComment } from '../../types/entities';
import type { CommentId } from '../../types/ids';

/** A top-level comment with its replies. `comment` is null when only its replies are visible. */
export interface ThreadGroup {
  readonly id: CommentId;
  readonly comment: ThreadComment | null;
  readonly replies: readonly ThreadComment[];
}

/**
 * Arranges a flat list into a one-level thread: newest conversations first, and each
 * conversation's replies in the order they were written. Replies whose parent the viewer can no
 * longer see keep their place under a placeholder rather than vanishing.
 */
export function groupThread(comments: readonly ThreadComment[]): readonly ThreadGroup[] {
  const repliesByParent = new Map<CommentId, ThreadComment[]>();
  const topLevel: ThreadComment[] = [];
  for (const comment of comments) {
    if (comment.parentId === null) topLevel.push(comment);
    else
      repliesByParent.set(comment.parentId, [
        ...(repliesByParent.get(comment.parentId) ?? []),
        comment,
      ]);
  }

  const groups: ThreadGroup[] = topLevel.map((comment) => ({
    id: comment.id,
    comment,
    replies: repliesByParent.get(comment.id) ?? [],
  }));
  const shown = new Set(topLevel.map((comment) => comment.id));
  for (const [parentId, replies] of repliesByParent) {
    if (!shown.has(parentId)) groups.push({ id: parentId, comment: null, replies });
  }

  const newestActivity = (group: ThreadGroup) =>
    group.comment?.createdAt ?? group.replies[0]?.createdAt ?? '';
  return groups
    .map((group) => ({
      ...group,
      replies: [...group.replies].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => newestActivity(b).localeCompare(newestActivity(a)));
}

/** "Just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (seconds < 45) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
