import type {
  FeedPost,
  FeedRepository,
  PublishFeedPostInput,
  UserVoteRecord,
} from '../../ports/feed';
import type { UtcDateTime } from '../../types/date-time';
import type { VoteChoice, VoteCounts } from '../../types/entities';
import { err, ok } from '../../types/result';
import { screenWithRules } from './screening';

export interface LocalFeedRepositoryOptions {
  readonly seed?: readonly FeedPost[];
  readonly seedVotes?: readonly UserVoteRecord[];
  readonly viewerHandle?: string;
}

function slugify(text: string, suffix: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44)
    .replace(/-$/g, '');
  return `${base.length >= 2 ? base : 'post'}-${suffix}`;
}

function adjustTally(
  tally: VoteCounts,
  previous: VoteChoice | null,
  next: VoteChoice | null,
): VoteCounts {
  let tooHigh = tally.too_high;
  let justRight = tally.just_right;
  let tooLow = tally.too_low;

  if (previous === 'too_high') tooHigh = Math.max(0, tooHigh - 1);
  else if (previous === 'just_right') justRight = Math.max(0, justRight - 1);
  else if (previous === 'too_low') tooLow = Math.max(0, tooLow - 1);

  if (next === 'too_high') tooHigh += 1;
  else if (next === 'just_right') justRight += 1;
  else if (next === 'too_low') tooLow += 1;

  return {
    too_high: tooHigh,
    just_right: justRight,
    too_low: tooLow,
  };
}

/**
 * In-memory Feed repository seeded from the preview feed posts and votes when no Supabase
 * backend is configured.
 */
export function createLocalFeedRepository(
  options: LocalFeedRepositoryOptions = {},
): FeedRepository {
  const viewerHandle = options.viewerHandle ?? 'retro_curator';
  let posts: FeedPost[] = [...(options.seed ?? [])];
  let votes: UserVoteRecord[] = [...(options.seedVotes ?? [])];
  let nextSeq = 1;

  function findPost(idOrSlug: string): FeedPost | undefined {
    return posts.find((post) => post.id === idOrSlug || post.slug === idOrSlug);
  }

  return {
    async list() {
      return ok(posts);
    },

    async getByIdOrSlug(idOrSlug) {
      return ok(findPost(idOrSlug) ?? null);
    },

    async publish(input: PublishFeedPostInput) {
      const body = input.body.trim();
      const title = input.title.trim();
      if (body.length === 0) {
        return err({ kind: 'validation', code: 'empty_body' });
      }
      if (body.length > 280) {
        return err({ kind: 'validation', code: 'too_long' });
      }
      const seq = String(nextSeq++).padStart(4, '0');
      const id = `local-post-${seq}`;
      const slug = slugify(title || body, seq);
      const now = new Date().toISOString() as UtcDateTime;
      const moderationStatus = screenWithRules(body);
      const created: FeedPost = {
        id,
        slug,
        title: title || 'Community price check',
        category: input.category ?? null,
        body,
        estimate: Math.max(0, Math.round(input.estimate)),
        photoUrl: input.photoUrl ?? null,
        photoLabel: title || body,
        votes: { too_high: 0, just_right: 0, too_low: 0 },
        moderationStatus,
        createdAt: now,
        author: { handle: viewerHandle },
        scanId: input.scanId ?? null,
        listing:
          input.listingId && input.listingAskingPrice
            ? {
                id: input.listingId,
                slug: input.listingId,
                askingPrice: Math.round(input.listingAskingPrice),
              }
            : null,
        isMine: true,
      };
      posts = [created, ...posts];
      return ok(created);
    },

    async remove(idOrSlug) {
      const target = findPost(idOrSlug);
      if (!target) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      posts = posts.filter((post) => post.id !== target.id);
      votes = votes.filter((vote) => vote.postId !== target.id && vote.postSlug !== target.slug);
      return ok(undefined);
    },

    async listVotes() {
      return ok(votes);
    },

    async setVote(postIdOrSlug, choice) {
      const target = findPost(postIdOrSlug);
      if (!target) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      const existing = votes.find(
        (entry) => entry.postId === target.id || entry.postSlug === target.slug,
      );
      const previous = existing?.choice ?? null;
      const updatedVotes = adjustTally(target.votes, previous, choice);
      const updatedPost: FeedPost = { ...target, votes: updatedVotes };
      posts = posts.map((entry) => (entry.id === target.id ? updatedPost : entry));

      const now = new Date().toISOString() as UtcDateTime;
      if (choice === null) {
        votes = votes.filter(
          (entry) => entry.postId !== target.id && entry.postSlug !== target.slug,
        );
      } else {
        const record: UserVoteRecord = {
          postId: target.id,
          postSlug: target.slug,
          choice,
          castAt: now,
        };
        votes = [
          record,
          ...votes.filter((entry) => entry.postId !== target.id && entry.postSlug !== target.slug),
        ];
      }

      return ok({ votes: updatedVotes, choice });
    },
  };
}
