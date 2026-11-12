import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AdminRepository, ReviewCase, ReviewDecision } from '../../ports/admin';
import type { AppError } from '../../types/errors';
import { err, type Result } from '../../types/result';

export type ReviewLoadStatus = 'loading' | 'ready' | 'failed' | 'denied';

export interface AdminReviewState {
  readonly status: ReviewLoadStatus;
  /** Open cases, most reported first. */
  readonly cases: readonly ReviewCase[];
  readonly refresh: () => Promise<void>;
  readonly decide: (item: ReviewCase, decision: ReviewDecision) => Promise<Result<void, AppError>>;
}

const AdminContext = createContext<AdminRepository | null>(null);

/** Supplied once by the app's composition root; screens never pick their own storage. */
export function AdminProvider({
  repository,
  children,
}: {
  readonly repository: AdminRepository;
  readonly children: ReactNode;
}) {
  return <AdminContext.Provider value={repository}>{children}</AdminContext.Provider>;
}

/** Without a provider (a screen rendered on its own, as in tests) nobody is an admin. */
const nobody: AdminRepository = {
  queue: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
  decide: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
};

/**
 * The review queue as the database gives it. `denied` means the signed-in person isn't an admin
 * (or isn't signed in): the database refused, whatever the app showed them to get here.
 */
export function useAdminReview(): AdminReviewState {
  const repository = useContext(AdminContext) ?? nobody;
  const [status, setStatus] = useState<ReviewLoadStatus>('loading');
  const [cases, setCases] = useState<readonly ReviewCase[]>([]);

  const refresh = useCallback(async () => {
    const result = await repository.queue();
    if (result.ok) {
      setCases(result.value);
      setStatus('ready');
    } else if (result.error.kind === 'authorization') {
      setCases([]);
      setStatus('denied');
    } else {
      setStatus((current) => (current === 'ready' ? 'ready' : 'failed'));
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = useCallback(
    async (item: ReviewCase, decision: ReviewDecision) => {
      const result = await repository.decide(item, decision);
      // Success or refusal, the server's list is the truth: the case may be gone already.
      await refresh();
      return result;
    },
    [refresh, repository],
  );

  return useMemo(() => ({ status, cases, refresh, decide }), [cases, decide, refresh, status]);
}

/** How many cases wait, for an admin's profile; nothing until it's known, and for anyone else. */
export function useReviewCount(): number | null {
  const { status, cases } = useAdminReview();
  return status === 'ready' ? cases.length : null;
}
