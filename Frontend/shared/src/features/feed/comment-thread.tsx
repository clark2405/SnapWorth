import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CommentService } from '../../ports/services';
import type { CommentReceipt, ThreadComment } from '../../types/entities';
import type { AppError, ModerationError } from '../../types/errors';
import type { CommentId } from '../../types/ids';
import type { Result } from '../../types/result';
import { groupThread, type ThreadGroup } from './comment-thread-model';

interface CommentContextValue {
  readonly service: CommentService;
  /** Bumped whenever this device changes a thread, so counts elsewhere refresh. */
  readonly revision: number;
  readonly changed: () => void;
}

const CommentServiceContext = createContext<CommentContextValue | null>(null);

/** Supplied once by the app's composition root; views never pick their own storage. */
export function CommentServiceProvider({
  service,
  children,
}: {
  readonly service: CommentService;
  readonly children: ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  const value = useMemo(
    () => ({ service, revision, changed: () => setRevision((current) => current + 1) }),
    [revision, service],
  );
  return <CommentServiceContext.Provider value={value}>{children}</CommentServiceContext.Provider>;
}

function useCommentContext(): CommentContextValue {
  const context = useContext(CommentServiceContext);
  if (!context) throw new Error('Comment hooks need a CommentServiceProvider above them.');
  return context;
}

/** How many comments a post's thread shows this viewer; null until it has loaded. */
export function useCommentCount(postKey: string): number | null {
  const { service, revision } = useCommentContext();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void service.listThread(postKey).then((result) => {
      if (active && result.ok) setCount(result.value.length);
    });
    return () => {
      active = false;
    };
  }, [postKey, revision, service]);
  return count;
}

export type ThreadStatus = 'loading' | 'ready' | 'failed';

export interface CommentThreadState {
  readonly status: ThreadStatus;
  readonly error: AppError | null;
  readonly comments: readonly ThreadComment[];
  readonly groups: readonly ThreadGroup[];
  readonly reload: () => void;
  readonly submit: (
    body: string,
    replyTo?: CommentId,
  ) => Promise<Result<CommentReceipt, ModerationError>>;
  readonly remove: (comment: ThreadComment) => Promise<Result<void, AppError>>;
  readonly report: (comment: ThreadComment) => Promise<Result<void, AppError>>;
}

/**
 * One post's discussion: loads it, and keeps it in step as the viewer posts, replies, deletes
 * and reports. Deleting and reporting update the screen straight away and roll back if the
 * server refuses.
 */
export function useCommentThread(postKey: string): CommentThreadState {
  const { service, changed } = useCommentContext();
  const [status, setStatus] = useState<ThreadStatus>('loading');
  const [error, setError] = useState<AppError | null>(null);
  const [comments, setComments] = useState<readonly ThreadComment[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void service.listThread(postKey).then((result) => {
      if (!active) return;
      if (result.ok) {
        setComments(result.value);
        setError(null);
        setStatus('ready');
      } else {
        setError(result.error);
        setStatus('failed');
      }
    });
    return () => {
      active = false;
    };
  }, [attempt, postKey, service]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const submit = useCallback(
    async (body: string, replyTo?: CommentId) => {
      const result = await service.submit(postKey, body, replyTo);
      if (result.ok) {
        setComments((current) => [result.value.comment, ...current]);
        changed();
      }
      return result;
    },
    [changed, postKey, service],
  );

  const remove = useCallback(
    async (comment: ThreadComment) => {
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
      const result = await service.remove(comment.id);
      if (!result.ok) setComments((current) => [comment, ...current]);
      else {
        // Replies to a deleted comment stay, now under a placeholder.
        setComments((current) =>
          current.map((entry) =>
            entry.parentId === comment.id ? { ...entry, parentHidden: true } : entry,
          ),
        );
        changed();
      }
      return result;
    },
    [changed, service],
  );

  const report = useCallback(
    async (comment: ThreadComment) => {
      const mark = (reportedByMe: boolean) =>
        setComments((current) =>
          current.map((entry) => (entry.id === comment.id ? { ...entry, reportedByMe } : entry)),
        );
      mark(true);
      const result = await service.report(comment.id, 'other');
      if (!result.ok) mark(false);
      return result;
    },
    [service],
  );

  const groups = useMemo(() => groupThread(comments), [comments]);

  return { status, error, comments, groups, reload, submit, remove, report };
}
