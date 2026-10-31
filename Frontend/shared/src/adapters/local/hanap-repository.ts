import type { HanapPost, HanapRepository } from '../../ports/hanap';
import type { UtcDateTime } from '../../types/date-time';
import type { PublicProfile } from '../../types/entities';
import { err, ok } from '../../types/result';
import type { KeyValueStore } from './comment-repository';

const storageKey = 'snapworth.hanap.v1';

/** A post a fresh install starts with, someone else's unless `mine`. */
export interface LocalSeedHanap {
  readonly id: string;
  readonly authorHandle: string;
  readonly body: string;
  readonly maxPhp: number | null;
  readonly createdAt: UtcDateTime;
  readonly mine?: boolean;
}

export interface LocalHanapRepositoryOptions {
  readonly store: KeyValueStore;
  /** Who is using this device; their posts are "mine". */
  readonly viewer: PublicProfile;
  readonly seed: readonly LocalSeedHanap[];
  /** Screens a new post, as the server's moderation would. */
  readonly screen: (body: string) => 'approved' | 'held';
  readonly now?: () => Date;
}

/**
 * Hanap posts kept on this device, for a build without a Supabase project. Same rules as the
 * server: posts are tidied and screened, held ones are only seen by their author, and only the
 * author can close or delete theirs.
 */
export function createLocalHanapRepository({
  store,
  viewer,
  seed,
  screen,
  now = () => new Date(),
}: LocalHanapRepositoryOptions): HanapRepository {
  let posts: HanapPost[] | null = null;

  async function load(): Promise<HanapPost[]> {
    if (posts) return posts;
    const saved = await store.getItem(storageKey).catch(() => null);
    posts = saved
      ? (JSON.parse(saved) as HanapPost[])
      : seed.map((entry) => ({
          id: entry.id,
          authorHandle: entry.mine ? viewer.handle : entry.authorHandle,
          body: entry.body,
          maxPhp: entry.maxPhp,
          status: 'open' as const,
          moderation: 'approved' as const,
          createdAt: entry.createdAt,
          mine: entry.mine ?? false,
        }));
    return posts;
  }

  async function save(next: HanapPost[]) {
    posts = next;
    await store.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
  }

  return {
    async list() {
      const all = await load();
      const visible = all.filter(
        (post) => post.mine || (post.status === 'open' && post.moderation === 'approved'),
      );
      return ok([...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },

    async post({ body, maxPhp }) {
      const text = body.replace(/\s+/g, ' ').trim();
      if (text.length < 3 || text.length > 140) {
        return err({ kind: 'validation', code: 'rejected', field: 'hanap' });
      }
      const post: HanapPost = {
        id: `local-hanap-${now().getTime().toString(36)}`,
        authorHandle: viewer.handle,
        body: text,
        maxPhp,
        status: 'open',
        moderation: screen(text),
        createdAt: now().toISOString() as UtcDateTime,
        mine: true,
      };
      await save([post, ...(await load())]);
      return ok(post);
    },

    async setFound(id, found) {
      const all = await load();
      const target = all.find((post) => post.id === id);
      if (!target?.mine) return err({ kind: 'authorization', code: 'not_found_or_denied' });
      await save(
        all.map((post) => (post.id === id ? { ...post, status: found ? 'found' : 'open' } : post)),
      );
      return ok(undefined);
    },

    async remove(id) {
      const all = await load();
      const target = all.find((post) => post.id === id);
      if (!target?.mine) return err({ kind: 'authorization', code: 'not_found_or_denied' });
      await save(all.filter((post) => post.id !== id));
      return ok(undefined);
    },
  };
}
