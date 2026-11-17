import type {
  AdminRepository,
  ModeratedPerson,
  ModerationEntry,
  ReviewCase,
} from '../../ports/admin';
import type { UtcDateTime } from '../../types/date-time';
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
  // The people behind the sample cases, so the console has someone to look up.
  let people: ModeratedPerson[] = [...new Set(seed.map((entry) => entry.authorHandle))].map(
    (handle, index) => ({
      id: `person:${handle}`,
      handle,
      displayName: null,
      avatarUrl: null,
      joinedAt: '2026-10-01T00:00:00.000Z' as UtcDateTime,
      postCount: 1 + index,
      commentCount: 2 + index,
      listingCount: index % 2,
      reportsAgainst: seed
        .filter((entry) => entry.authorHandle === handle)
        .reduce((total, entry) => total + entry.reportCount, 0),
      removedCount: 0,
      suspended: false,
      suspendedUntil: null,
      suspensionReason: null,
      isAdmin: false,
    }),
  );
  let history: ModerationEntry[] = [];
  const now = () => new Date().toISOString() as UtcDateTime;
  const log = (entry: Omit<ModerationEntry, 'id' | 'decidedAt' | 'decidedBy'>) => {
    history = [
      { ...entry, id: `log:${history.length + 1}`, decidedAt: now(), decidedBy: 'you' },
      ...history,
    ];
  };

  return {
    async overview() {
      return ok({
        openCases: cases.length,
        reportsThisWeek: cases.reduce((total, entry) => total + entry.reportCount, 0),
        suspendedAccounts: people.filter((person) => person.suspended).length,
        newAccountsThisWeek: 0,
        postsThisWeek: 0,
        decisionsThisWeek: history.length,
      });
    },

    async people(search) {
      const term = search.trim().replace(/^@/, '').toLowerCase();
      return ok(
        people
          .filter((person) => !term || person.handle.toLowerCase().includes(term))
          .sort((a, b) => b.reportsAgainst - a.reportsAgainst),
      );
    },

    async suspend(personId, input) {
      const person = people.find((entry) => entry.id === personId);
      if (!person || !input.reason.trim()) return err(refused);
      const until =
        input.days === null
          ? null
          : (new Date(Date.now() + input.days * 86_400_000).toISOString() as UtcDateTime);
      people = people.map((entry) =>
        entry === person
          ? { ...entry, suspended: true, suspendedUntil: until, suspensionReason: input.reason }
          : entry,
      );
      if (input.takeDown) cases = cases.filter((entry) => entry.authorHandle !== person.handle);
      log({
        kind: 'account',
        targetId: personId,
        decision: 'suspend',
        note: input.reason,
        targetLabel: `@${person.handle}`,
      });
      return ok(undefined);
    },

    async reinstate(personId) {
      const person = people.find((entry) => entry.id === personId && entry.suspended);
      if (!person) return err(refused);
      people = people.map((entry) =>
        entry === person
          ? { ...entry, suspended: false, suspendedUntil: null, suspensionReason: null }
          : entry,
      );
      log({
        kind: 'account',
        targetId: personId,
        decision: 'reinstate',
        note: null,
        targetLabel: `@${person.handle}`,
      });
      return ok(undefined);
    },

    async history() {
      return ok(history);
    },

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
      log({
        kind,
        targetId,
        decision,
        note: null,
        targetLabel: (target.title ?? target.body).slice(0, 80),
      });
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
