import type { CommentRepository } from '../../ports/comments';
import type {
  CommentBody,
  ModerationStatus,
  PublicProfile,
  ThreadComment,
} from '../../types/entities';
import type { UtcDateTime } from '../../types/date-time';
import type { CommentId } from '../../types/ids';
import { err, ok } from '../../types/result';

/** The two calls of AsyncStorage (or localStorage) this store needs. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface LocalSeedComment {
  readonly id: string;
  readonly postKey: string;
  readonly parentId: string | null;
  readonly body: string;
  readonly author: PublicProfile;
  readonly createdAt: UtcDateTime;
}

interface StoredComment extends LocalSeedComment {
  readonly status: ModerationStatus;
  readonly deleted: boolean;
  readonly reporters: readonly string[];
}

export interface LocalCommentRepositoryOptions {
  readonly store: KeyValueStore;
  /** Who is using this device; their comments are "mine". */
  readonly viewer: PublicProfile;
  /** The discussion a fresh install starts with. */
  readonly seed: readonly LocalSeedComment[];
  /** Decides each new comment, like the server's moderation does. */
  readonly screen: (body: string) => 'approved' | 'held';
  readonly storageKey?: string;
}

/** Same threshold as the database: three reports hold a comment for review. */
const reportsToHold = 3;

function newId(): string {
  const bytes = new Uint8Array(16);
  const crypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Comments kept on this device, for running the app before a Supabase project is configured.
 * It applies the same rules the database enforces (who sees what, one-level replies, deleting
 * only your own, no self-reports, three reports hold a comment) so the app behaves the same
 * either way. Nothing here is shared with anyone else.
 */
export function createLocalCommentRepository(
  options: LocalCommentRepositoryOptions,
): CommentRepository {
  const { store, viewer, seed, screen } = options;
  const key = options.storageKey ?? 'snapworth.comments.v1';
  let cache: StoredComment[] | null = null;

  async function load(): Promise<StoredComment[]> {
    if (cache) return cache;
    try {
      const raw = await store.getItem(key);
      cache = raw ? (JSON.parse(raw) as StoredComment[]) : null;
    } catch {
      cache = null;
    }
    cache ??= seed.map((comment) => ({
      ...comment,
      status: 'approved',
      deleted: false,
      reporters: [],
    }));
    return cache;
  }

  async function save(next: StoredComment[]): Promise<void> {
    cache = next;
    try {
      await store.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or blocked: keep working from memory for this session.
    }
  }

  const visible = (comment: StoredComment) =>
    !comment.deleted && (comment.status === 'approved' || comment.author.userId === viewer.userId);

  function toThread(comment: StoredComment, all: readonly StoredComment[]): ThreadComment {
    const parent = comment.parentId
      ? all.find((entry) => entry.id === comment.parentId)
      : undefined;
    return {
      id: comment.id as CommentId,
      parentId: (comment.parentId as CommentId | null) ?? null,
      parentHidden: comment.parentId !== null && (!parent || !visible(parent)),
      body: comment.body as CommentBody,
      moderationStatus: comment.status,
      createdAt: comment.createdAt,
      author: comment.author,
      isMine: comment.author.userId === viewer.userId,
      reportedByMe: comment.reporters.includes(viewer.userId),
    };
  }

  return {
    async listThread(postKey) {
      const all = await load();
      return ok(
        all
          .filter((comment) => comment.postKey === postKey && visible(comment))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((comment) => toThread(comment, all)),
      );
    },

    async insert({ postKey, body, replyTo }) {
      const all = await load();
      let parentId: string | null = null;
      if (replyTo) {
        const parent = all.find((entry) => entry.id === replyTo);
        if (!parent || !visible(parent) || parent.postKey !== postKey) {
          return err({ kind: 'authorization', code: 'not_found_or_denied' });
        }
        // One level deep: a reply to a reply joins the top-level thread.
        parentId = parent.parentId ?? parent.id;
      }
      const comment: StoredComment = {
        id: newId(),
        postKey,
        parentId,
        body,
        author: viewer,
        createdAt: new Date().toISOString() as UtcDateTime,
        status: 'pending',
        deleted: false,
        reporters: [],
      };
      const next = [...all, comment];
      await save(next);
      return ok(toThread(comment, next));
    },

    async moderate(commentId) {
      const all = await load();
      const target = all.find((entry) => entry.id === commentId);
      if (!target) return err({ kind: 'authorization', code: 'not_found_or_denied' });
      if (target.status !== 'pending') return ok(target.status);
      const status = screen(target.body);
      await save(all.map((entry) => (entry.id === commentId ? { ...entry, status } : entry)));
      return ok(status);
    },

    async softDelete(commentId) {
      const all = await load();
      const target = all.find((entry) => entry.id === commentId);
      if (!target || target.deleted || target.author.userId !== viewer.userId) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      await save(
        all.map((entry) => (entry.id === commentId ? { ...entry, deleted: true } : entry)),
      );
      return ok(undefined);
    },

    async report(commentId) {
      const all = await load();
      const target = all.find((entry) => entry.id === commentId);
      // Reporting again is harmless, even once your report has helped hold the comment.
      if (target?.reporters.includes(viewer.userId)) return ok(undefined);
      if (!target || !visible(target) || target.author.userId === viewer.userId) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      const reporters = [...target.reporters, viewer.userId];
      const status: ModerationStatus =
        target.status === 'approved' && reporters.length >= reportsToHold ? 'held' : target.status;
      await save(
        all.map((entry) => (entry.id === commentId ? { ...entry, reporters, status } : entry)),
      );
      return ok(undefined);
    },
  };
}
