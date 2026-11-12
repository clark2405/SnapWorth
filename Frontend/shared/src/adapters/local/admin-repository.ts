import type { AdminRepository, ReviewCase } from '../../ports/admin';
import { err, ok } from '../../types/result';

/** Most reported first, then the oldest, as the server lists it. */
function inQueueOrder(cases: readonly ReviewCase[]): ReviewCase[] {
  return [...cases].sort(
    (a, b) => b.reportCount - a.reportCount || a.flaggedAt.localeCompare(b.flaggedAt),
  );
}

/**
 * The review queue on a device with no Supabase project: the sample cases it's given, decided
 * under the server's rules, and forgotten when the app restarts. It never touches the device's
 * real comments or posts, so approving here changes nothing anyone else would see.
 */
export function createLocalAdminRepository({
  seed,
}: {
  readonly seed: readonly ReviewCase[];
}): AdminRepository {
  let cases = [...seed];
  const refused = { kind: 'authorization', code: 'not_found_or_denied' } as const;

  return {
    async queue() {
      return ok(inQueueOrder(cases));
    },

    async decide({ kind, targetId }, decision) {
      const target = cases.find((entry) => entry.kind === kind && entry.targetId === targetId);
      if (!target) return err(refused);
      const rejected = err({ kind: 'validation', code: 'rejected', field: 'review' } as const);

      if (kind === 'conversation' && decision !== 'dismiss') return rejected;
      if (decision === 'dismiss' && target.reportCount === 0) return rejected;

      const others = cases.filter((entry) => entry !== target);
      switch (decision) {
        case 'approve':
        case 'remove':
          cases = others;
          break;
        case 'hold':
          cases = [...others, { ...target, status: 'held' }];
          break;
        case 'dismiss': {
          // Held content stays to be looked at; an approved one has nothing left to review.
          const closed: ReviewCase = { ...target, reportCount: 0, reportReasons: [] };
          cases =
            target.status === 'held' || target.status === 'pending' ? [...others, closed] : others;
          break;
        }
      }
      return ok(undefined);
    },
  };
}
