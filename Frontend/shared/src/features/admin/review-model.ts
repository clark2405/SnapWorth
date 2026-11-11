import type { ReviewCase, ReviewDecision, ReviewKind } from '../../ports/admin';
import type { AppError } from '../../types/errors';

const kindLabels: Readonly<Record<ReviewKind, string>> = {
  comment: 'Comment',
  post: 'Feed post',
  hanap: 'Hanap',
  conversation: 'Chat report',
};

export function kindLabel(kind: ReviewKind): string {
  return kindLabels[kind];
}

export const decisionLabels: Readonly<Record<ReviewDecision, string>> = {
  approve: 'Approve',
  hold: 'Hold',
  remove: 'Remove',
  dismiss: 'Dismiss reports',
};

/**
 * The buttons a case offers, in the order they show. Content that isn't public yet is approved
 * or removed; public content someone reported is dismissed, held for a closer look, or removed;
 * a conversation's messages are private, so its reports can only be dismissed.
 */
export function reviewActions(item: ReviewCase): readonly ReviewDecision[] {
  if (item.kind === 'conversation') return ['dismiss'];
  if (item.status === 'approved') return ['remove', 'hold', 'dismiss'];
  return ['remove', 'approve'];
}

/** "spam" → "spam", "prohibited_item" → "prohibited item". */
function plainReason(reason: string): string {
  return reason.replace(/_/g, ' ');
}

/** Why moderation held something, in words: `moderate-content` records its provider and reason. */
function heldBecause(ref: string | null): string {
  if (!ref) return 'Held for review';
  if (ref === 'community-reports') return 'Held after three reports';
  if (ref === 'no-provider-configured') return 'Held: no moderation provider is set up yet';
  if (ref.startsWith('admin:')) return 'Held by an admin';
  if (ref.startsWith('error:')) return 'Held: moderation hit an error';
  const rules = /^rules \((.+)\)$/.exec(ref);
  if (rules) return `Flagged by the word rules: ${rules[1]}`;
  const provider = /^[a-z]+:.*\((.+)\)$/.exec(ref);
  if (provider) return `Flagged by moderation: ${provider[1]}`;
  return 'Held for review';
}

/** One line on why a case is here: what moderation said, and what people reported. */
export function flagReason(item: ReviewCase): string {
  const reasons = [...new Set(item.reportReasons.map(plainReason))];
  const reported = item.reportCount > 0 ? `Reported for ${reasons.join(', ') || 'review'}` : null;
  if (item.kind === 'conversation') return reported ?? 'Reported';
  const state =
    item.status === 'held'
      ? heldBecause(item.flagRef)
      : item.status === 'pending'
        ? 'Moderation never finished'
        : null;
  return [state, reported].filter(Boolean).join(' · ') || 'Needs a look';
}

/** "3h ago", "2d ago": how long ago a case was flagged. */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

/** What the toast says once a decision has gone through. */
export function decisionToast(
  item: ReviewCase,
  decision: ReviewDecision,
): { readonly title: string; readonly body: string } {
  const what = `${kindLabel(item.kind)} by @${item.authorHandle}`;
  switch (decision) {
    case 'approve':
      return { title: 'Approved', body: `${what} is now public.` };
    case 'hold':
      return { title: 'Held', body: `${what} is hidden until you decide.` };
    case 'remove':
      return { title: 'Removed', body: `${what} was removed.` };
    case 'dismiss':
      return { title: 'Reports dismissed', body: `${what} stays as it is.` };
  }
}

/** What to tell an admin whose decision the database turned down. */
export function reviewErrorCopy(error: AppError): {
  readonly title: string;
  readonly body?: string;
} {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
      return { title: 'Not saved', body: "You're offline. Try again." };
    case 'authorization':
      return { title: 'That case is gone', body: 'It was already decided, or removed.' };
    case 'validation':
      return { title: "That can't be done", body: 'There is nothing left to dismiss.' };
    default:
      return { title: 'Something went wrong', body: 'Try again in a moment.' };
  }
}
