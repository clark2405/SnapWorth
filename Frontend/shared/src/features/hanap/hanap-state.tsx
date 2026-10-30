import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { HanapPost, HanapRepository, NewHanap } from '../../ports/hanap';
import type { AppError } from '../../types/errors';
import { err, ok, type Result } from '../../types/result';

export type HanapLoadStatus = 'loading' | 'ready' | 'failed';

export interface HanapState {
  readonly status: HanapLoadStatus;
  /** The viewer's own posts. */
  readonly mine: readonly HanapPost[];
  /** Everyone else's open posts. */
  readonly others: readonly HanapPost[];
  readonly refresh: () => Promise<void>;
  readonly post: (hanap: NewHanap) => Promise<Result<HanapPost, AppError>>;
  readonly setFound: (id: string, found: boolean) => Promise<Result<void, AppError>>;
  readonly remove: (id: string) => Promise<Result<void, AppError>>;
}

const HanapContext = createContext<HanapRepository | null>(null);

/** Supplied once by the app's composition root; screens never pick their own storage. */
export function HanapProvider({
  repository,
  children,
}: {
  readonly repository: HanapRepository;
  readonly children: ReactNode;
}) {
  return <HanapContext.Provider value={repository}>{children}</HanapContext.Provider>;
}

/** Without a provider (a screen rendered on its own, as in tests) there's nothing to show. */
const nowhere: HanapRepository = {
  list: () => Promise.resolve(ok([])),
  post: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
  setFound: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
  remove: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
};

/** Hanap posts: the viewer's own, and everyone else's open ones, newest first. */
export function useHanap(): HanapState {
  const repository = useContext(HanapContext) ?? nowhere;
  const [status, setStatus] = useState<HanapLoadStatus>('loading');
  const [posts, setPosts] = useState<readonly HanapPost[]>([]);

  const refresh = useCallback(async () => {
    const result = await repository.list();
    if (result.ok) {
      setPosts(result.value);
      setStatus('ready');
    } else {
      setStatus((current) => (current === 'ready' ? 'ready' : 'failed'));
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const after = useCallback(
    async <T,>(result: Result<T, AppError>) => {
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  return useMemo(
    () => ({
      status,
      mine: posts.filter((post) => post.mine),
      others: posts.filter((post) => !post.mine),
      refresh,
      post: async (hanap: NewHanap) => after(await repository.post(hanap)),
      setFound: async (id: string, found: boolean) => after(await repository.setFound(id, found)),
      remove: async (id: string) => after(await repository.remove(id)),
    }),
    [after, posts, refresh, repository, status],
  );
}
