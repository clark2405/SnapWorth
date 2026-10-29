import type { ModerationError, OperationName } from '../../types/errors';

interface ErrorLike {
  readonly code?: string;
  readonly message?: string;
  readonly status?: number;
}

/** The database's own codes for a chat that can no longer take a message or an answer. */
const chatConflicts: Readonly<Record<string, string>> = {
  SWCLO: 'conversation_closed',
  SWBLK: 'blocked',
  SWOLD: 'offer_not_open',
};

/**
 * Normalises Supabase and network failures into the app's error vocabulary. Every kind it
 * produces is also a valid moderation error, so it serves both reads and submissions.
 * `field` names what a rejected value was, for the screen's message.
 */
export function toAppError(
  error: unknown,
  operation: OperationName,
  field = 'comment',
): ModerationError {
  const { code, message = '', status } = (error ?? {}) as ErrorLike;
  if (error instanceof TypeError || /network|fetch failed|load failed/i.test(message)) {
    return { kind: 'offline', operation, retryable: true };
  }
  if (code === '42501' || status === 401 || status === 403) {
    return { kind: 'authorization', code: 'not_found_or_denied' };
  }
  if (code === 'P0002' || code === 'PGRST116') {
    return { kind: 'authorization', code: 'not_found_or_denied' };
  }
  const conflict = code ? chatConflicts[code] : undefined;
  if (conflict) return { kind: 'conflict', code: conflict, retryable: false };
  if (code === 'P0001' || status === 429) {
    return { kind: 'rate_limited', operation, retryable: true };
  }
  if (code === '23514' || code === '22023') {
    return { kind: 'validation', code: 'rejected', field };
  }
  return { kind: 'unknown', requestId: code ?? String(status ?? 'unknown'), retryable: true };
}
