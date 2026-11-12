import type { UtcDateTime } from '../types/date-time';
import type { ModerationStatus, VoteChoice, VoteCounts } from '../types/entities';
import type { AppError } from '../types/errors';
import type { Result } from '../types/result';
import type { MarketCategory } from './marketplace';

export interface FeedPostAuthor {
  readonly userId?: string;
  readonly handle: string;
  readonly avatarUrl?: string | null;
}

export interface FeedPostListingLink {
  readonly id: string;
  readonly slug: string;
  readonly askingPrice: number;
}

export interface FeedPost {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly category?: MarketCategory | null;
  readonly body: string;
  /** The AI estimate the post asks the community to judge. Null when the post has no scan. */
  readonly estimate: number | null;
  readonly photoUrl?: string | null;
  readonly photoLabel: string;
  readonly votes: VoteCounts;
  readonly moderationStatus: ModerationStatus;
  readonly createdAt: UtcDateTime;
  readonly author: FeedPostAuthor;
  readonly scanId?: string | null;
  readonly listing?: FeedPostListingLink | null;
  readonly isMine: boolean;
}

export interface UserVoteRecord {
  readonly postId: string;
  readonly postSlug: string;
  readonly choice: VoteChoice;
  readonly castAt: UtcDateTime;
}

export interface PublishFeedPostInput {
  readonly title: string;
  readonly body: string;
  /**
   * Only the on-device adapter uses this. Supabase ignores it: the database copies the estimate
   * from the linked scan or listing, so a client can't claim an AI value it didn't get.
   */
  readonly estimate?: number | null;
  readonly category?: MarketCategory | null;
  readonly scanId?: string | null;
  readonly listingId?: string | null;
  readonly listingAskingPrice?: number | null;
  readonly photoPath?: string | null;
  readonly photoUrl?: string | null;
}

/**
 * Community price-check posts and the viewer's votes on them (`feed_posts` and `votes` in
 * Supabase; in-memory fallback when no backend is configured).
 */
export interface FeedRepository {
  list(): Promise<Result<readonly FeedPost[], AppError>>;
  getByIdOrSlug(idOrSlug: string): Promise<Result<FeedPost | null, AppError>>;
  publish(input: PublishFeedPostInput): Promise<Result<FeedPost, AppError>>;
  remove(idOrSlug: string): Promise<Result<void, AppError>>;
  listVotes(): Promise<Result<readonly UserVoteRecord[], AppError>>;
  setVote(
    postIdOrSlug: string,
    choice: VoteChoice | null,
  ): Promise<Result<{ readonly votes: VoteCounts; readonly choice: VoteChoice | null }, AppError>>;
}
