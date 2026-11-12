import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ImageSourcePropType } from 'react-native';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import type {
  FeedPost,
  FeedRepository,
  PublishFeedPostInput,
  UserVoteRecord,
} from '../../ports/feed';
import type { UtcDateTime } from '../../types/date-time';
import type { VoteChoice, VoteCounts } from '../../types/entities';
import type { AppError } from '../../types/errors';
import { err, ok, type Result } from '../../types/result';
import type { PreviewPost } from '../preview/sample-data';
import { useSession } from '../session';
import {
  buildPreviewFeedPosts,
  buildPreviewFeedVotes,
  isDevicePost,
  sampleAvatarFor,
  sampleFeedPhoto,
  sampleFeedPost,
} from './feed-seed';

export function formatRelativeAgo(iso: string, fallback = 'Just now'): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return fallback;
  const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/** A post's photo: its own, the bundled one of a post made on this device, or none. */
export function feedPostPhotoSource(post: {
  readonly id: string;
  readonly photoUrl?: string | null;
  readonly listing?: { readonly slug?: string; readonly id?: string } | null;
}): ImageSourcePropType | null {
  if (post.photoUrl) return { uri: post.photoUrl };
  return isDevicePost(post) ? sampleFeedPhoto(post) : null;
}

/** An author's photo: their own, a sample person's on this device, or null (their initial). */
export function feedAuthorAvatarSource(
  author: { readonly handle: string; readonly avatarUrl?: string | null },
  post: { readonly id: string },
): ImageSourcePropType | null {
  if (author.avatarUrl) return { uri: author.avatarUrl };
  return isDevicePost(post) ? sampleAvatarFor(author.handle) : null;
}

export function toPreviewPost(post: FeedPost): PreviewPost {
  // A sample post keeps its sample discussion and "2m ago"; a post from Supabase never does.
  const sample = isDevicePost(post)
    ? (sampleFeedPost(post.slug) ?? sampleFeedPost(post.id))
    : undefined;
  return {
    id: post.slug || post.id,
    author: {
      handle: post.author.handle,
      avatar: feedAuthorAvatarSource(post.author, post),
    },
    postedAgo: sample?.postedAgo ?? formatRelativeAgo(post.createdAt),
    body: post.body,
    photo: feedPostPhotoSource(post),
    photoLabel: post.photoLabel || post.title || post.body,
    estimate: post.estimate,
    votes: post.votes,
    comments: sample?.comments ?? [],
    listing: post.listing
      ? {
          id: post.listing.slug || post.listing.id,
          askingPrice: post.listing.askingPrice,
        }
      : undefined,
  };
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

export interface FeedContextValue {
  readonly posts: readonly FeedPost[];
  readonly previewPosts: readonly PreviewPost[];
  readonly userVotes: readonly UserVoteRecord[];
  readonly loading: boolean;
  readonly refresh: () => Promise<void>;
  readonly findPost: (idOrSlug?: string) => FeedPost | undefined;
  readonly findPreviewPost: (idOrSlug?: string) => PreviewPost | undefined;
  readonly loadPost: (idOrSlug: string) => Promise<FeedPost | null>;
  readonly voteFor: (postIdOrSlug: string) => VoteChoice | null;
  readonly toggleVote: (
    postIdOrSlug: string,
    choice: VoteChoice,
  ) => Promise<Result<VoteChoice | null, AppError>>;
  readonly publishPost: (input: PublishFeedPostInput) => Promise<Result<FeedPost, AppError>>;
  readonly removePost: (idOrSlug: string) => Promise<Result<void, AppError>>;
  readonly findPostForScan: (scanId: string) => FeedPost | undefined;
}

const FeedContext = createContext<FeedContextValue | null>(null);

/** What to tell someone whose vote didn't go through. The tally and their choice are put back. */
export const voteNotSaved = {
  title: 'Couldn’t save your vote',
  body: 'Your vote is as it was. Check your connection and try again.',
} as const;

export interface FeedProviderProps {
  readonly repository?: FeedRepository;
  readonly children: ReactNode;
}

/**
 * The Feed's posts and the viewer's votes. It sits with the other services above the session (the
 * shells mount `AppServicesProvider` outside `SessionProvider`), so it knows nothing of who is
 * signed in: `useFeed` hides a guest's votes.
 */
export function FeedProvider({ repository, children }: FeedProviderProps) {
  const fallbackRepoRef = useRef<FeedRepository | null>(null);
  if (!fallbackRepoRef.current) {
    fallbackRepoRef.current = createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: buildPreviewFeedVotes(),
    });
  }
  const activeRepo = repository ?? fallbackRepoRef.current;

  // With a repository the Feed is whatever it holds (Supabase's posts, or the device
  // repository's sample ones), empty until it has loaded; without one it starts from the samples.
  const [posts, setPosts] = useState<readonly FeedPost[]>(() =>
    repository ? [] : buildPreviewFeedPosts(),
  );
  const [userVotes, setUserVotes] = useState<readonly UserVoteRecord[]>(() =>
    repository ? [] : buildPreviewFeedVotes(),
  );
  const [loading, setLoading] = useState(Boolean(repository));

  const refresh = useCallback(async () => {
    setLoading(true);
    const [postsResult, votesResult] = await Promise.all([
      activeRepo.list(),
      activeRepo.listVotes(),
    ]);
    if (postsResult.ok) setPosts(postsResult.value);
    if (votesResult.ok) setUserVotes(votesResult.value);
    setLoading(false);
  }, [activeRepo]);

  useEffect(() => {
    if (!repository) return;
    void refresh();
  }, [refresh, repository]);

  const previewPostsList = useMemo(() => posts.map(toPreviewPost), [posts]);

  const findPost = useCallback(
    (idOrSlug?: string): FeedPost | undefined => {
      if (!idOrSlug) return undefined;
      return posts.find((post) => post.id === idOrSlug || post.slug === idOrSlug);
    },
    [posts],
  );

  const findPreviewPost = useCallback(
    (idOrSlug?: string): PreviewPost | undefined => {
      if (!idOrSlug) return undefined;
      const found = findPost(idOrSlug);
      if (found) return toPreviewPost(found);
      // Only with no repository (a standalone screen) does a sample stand in for a missing post.
      return repository ? undefined : sampleFeedPost(idOrSlug);
    },
    [findPost, repository],
  );

  const loadPost = useCallback(
    async (idOrSlug: string): Promise<FeedPost | null> => {
      const result = await activeRepo.getByIdOrSlug(idOrSlug);
      if (!result.ok || !result.value) return findPost(idOrSlug) ?? null;
      const loaded = result.value;
      setPosts((current) => {
        const exists = current.some(
          (entry) => entry.id === loaded.id || entry.slug === loaded.slug,
        );
        if (exists) {
          return current.map((entry) =>
            entry.id === loaded.id || entry.slug === loaded.slug ? loaded : entry,
          );
        }
        return [loaded, ...current];
      });
      return loaded;
    },
    [activeRepo, findPost],
  );

  const voteFor = useCallback(
    (postIdOrSlug: string): VoteChoice | null => {
      const post = findPost(postIdOrSlug);
      const record = userVotes.find(
        (entry) =>
          entry.postId === postIdOrSlug ||
          entry.postSlug === postIdOrSlug ||
          (post && (entry.postId === post.id || entry.postSlug === post.slug)),
      );
      return record?.choice ?? null;
    },
    [findPost, userVotes],
  );

  const toggleVote = useCallback(
    async (
      postIdOrSlug: string,
      choice: VoteChoice,
    ): Promise<Result<VoteChoice | null, AppError>> => {
      const target = findPost(postIdOrSlug);
      const currentChoice = voteFor(postIdOrSlug);
      const nextChoice: VoteChoice | null = currentChoice === choice ? null : choice;
      const previousRecord = userVotes.find(
        (entry) =>
          entry.postId === postIdOrSlug ||
          entry.postSlug === postIdOrSlug ||
          (target && (entry.postId === target.id || entry.postSlug === target.slug)),
      );
      const isTarget = (entry: FeedPost) =>
        target !== undefined && (entry.id === target.id || entry.slug === target.slug);
      const isTargetVote = (entry: UserVoteRecord) =>
        entry.postId === postIdOrSlug ||
        entry.postSlug === postIdOrSlug ||
        (target !== undefined && (entry.postId === target.id || entry.postSlug === target.slug));

      if (target) {
        const optimisticVotes = adjustTally(target.votes, currentChoice, nextChoice);
        setPosts((current) =>
          current.map((entry) => (isTarget(entry) ? { ...entry, votes: optimisticVotes } : entry)),
        );
      }

      const now = new Date().toISOString() as UtcDateTime;
      setUserVotes((current) => {
        const filtered = current.filter((entry) => !isTargetVote(entry));
        if (nextChoice === null) return filtered;
        return [
          {
            postId: target?.id ?? postIdOrSlug,
            postSlug: target?.slug ?? postIdOrSlug,
            choice: nextChoice,
            castAt: now,
          },
          ...filtered,
        ];
      });

      const result = await activeRepo.setVote(target?.slug ?? postIdOrSlug, nextChoice);
      if (!result.ok) {
        // The vote didn't go through: put the tally and the person's choice back as they were.
        if (target) {
          setPosts((current) =>
            current.map((entry) =>
              isTarget(entry)
                ? { ...entry, votes: adjustTally(entry.votes, nextChoice, currentChoice) }
                : entry,
            ),
          );
        }
        setUserVotes((current) => {
          const filtered = current.filter((entry) => !isTargetVote(entry));
          return previousRecord ? [previousRecord, ...filtered] : filtered;
        });
        return err(result.error);
      }
      if (target) {
        setPosts((current) =>
          current.map((entry) =>
            isTarget(entry) ? { ...entry, votes: result.value.votes } : entry,
          ),
        );
      }
      return ok(nextChoice);
    },
    [activeRepo, findPost, userVotes, voteFor],
  );

  const publishPost = useCallback(
    async (input: PublishFeedPostInput): Promise<Result<FeedPost, AppError>> => {
      const result = await activeRepo.publish(input);
      if (result.ok) {
        setPosts((current) => [
          result.value,
          ...current.filter(
            (entry) => entry.id !== result.value.id && entry.slug !== result.value.slug,
          ),
        ]);
      }
      return result;
    },
    [activeRepo],
  );

  const removePost = useCallback(
    async (idOrSlug: string): Promise<Result<void, AppError>> => {
      const result = await activeRepo.remove(idOrSlug);
      if (result.ok) {
        setPosts((current) =>
          current.filter((entry) => entry.id !== idOrSlug && entry.slug !== idOrSlug),
        );
      }
      return result;
    },
    [activeRepo],
  );

  const findPostForScan = useCallback(
    (scanId: string): FeedPost | undefined => {
      return posts.find(
        (post) => post.scanId === scanId || post.id === scanId || post.slug === scanId,
      );
    },
    [posts],
  );

  const value = useMemo<FeedContextValue>(
    () => ({
      posts,
      previewPosts: previewPostsList,
      userVotes,
      loading,
      refresh,
      findPost,
      findPreviewPost,
      loadPost,
      voteFor,
      toggleVote,
      publishPost,
      removePost,
      findPostForScan,
    }),
    [
      findPost,
      findPostForScan,
      findPreviewPost,
      loadPost,
      loading,
      posts,
      previewPostsList,
      publishPost,
      refresh,
      removePost,
      toggleVote,
      userVotes,
      voteFor,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext);
  const { isGuest } = useSession();
  const [fallbackPosts, setFallbackPosts] = useState<readonly FeedPost[]>(() =>
    buildPreviewFeedPosts(),
  );
  const [fallbackVotes, setFallbackVotes] = useState<readonly UserVoteRecord[]>(() =>
    buildPreviewFeedVotes(),
  );
  const fallbackRepoRef = useRef<FeedRepository | null>(null);
  if (!fallbackRepoRef.current) {
    fallbackRepoRef.current = createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: buildPreviewFeedVotes(),
    });
  }

  const fallback = useMemo<FeedContextValue>(() => {
    const repo = fallbackRepoRef.current!;
    const findPost = (idOrSlug?: string) =>
      idOrSlug
        ? fallbackPosts.find((entry) => entry.id === idOrSlug || entry.slug === idOrSlug)
        : undefined;
    const voteFor = (postIdOrSlug: string): VoteChoice | null => {
      if (isGuest) return null;
      const post = findPost(postIdOrSlug);
      return (
        fallbackVotes.find(
          (entry) =>
            entry.postId === postIdOrSlug ||
            entry.postSlug === postIdOrSlug ||
            (post && (entry.postId === post.id || entry.postSlug === post.slug)),
        )?.choice ?? null
      );
    };
    return {
      posts: fallbackPosts,
      previewPosts: fallbackPosts.map(toPreviewPost),
      userVotes: isGuest ? [] : fallbackVotes,
      loading: false,
      refresh: async () => {
        const res = await repo.list();
        if (res.ok) setFallbackPosts(res.value);
      },
      findPost,
      findPreviewPost: (idOrSlug?: string) => {
        if (!idOrSlug) return undefined;
        const found = findPost(idOrSlug);
        return found ? toPreviewPost(found) : sampleFeedPost(idOrSlug);
      },
      loadPost: async (idOrSlug: string) => {
        const res = await repo.getByIdOrSlug(idOrSlug);
        return res.ok ? res.value : null;
      },
      voteFor,
      toggleVote: async (postIdOrSlug: string, choice: VoteChoice) => {
        const target = findPost(postIdOrSlug);
        const currentChoice = voteFor(postIdOrSlug);
        const nextChoice: VoteChoice | null = currentChoice === choice ? null : choice;
        if (target) {
          const updatedVotes = adjustTally(target.votes, currentChoice, nextChoice);
          setFallbackPosts((current) =>
            current.map((entry) =>
              entry.id === target.id ? { ...entry, votes: updatedVotes } : entry,
            ),
          );
        }
        const now = new Date().toISOString() as UtcDateTime;
        setFallbackVotes((current) => {
          const filtered = current.filter(
            (entry) =>
              entry.postId !== postIdOrSlug &&
              entry.postSlug !== postIdOrSlug &&
              (!target || (entry.postId !== target.id && entry.postSlug !== target.slug)),
          );
          if (nextChoice === null) return filtered;
          return [
            {
              postId: target?.id ?? postIdOrSlug,
              postSlug: target?.slug ?? postIdOrSlug,
              choice: nextChoice,
              castAt: now,
            },
            ...filtered,
          ];
        });
        await repo.setVote(postIdOrSlug, nextChoice);
        return ok(nextChoice);
      },
      publishPost: async (input: PublishFeedPostInput) => {
        const res = await repo.publish(input);
        if (res.ok) {
          setFallbackPosts((current) => [res.value, ...current]);
        }
        return res;
      },
      removePost: async (idOrSlug: string) => {
        const res = await repo.remove(idOrSlug);
        if (res.ok) {
          setFallbackPosts((current) =>
            current.filter((entry) => entry.id !== idOrSlug && entry.slug !== idOrSlug),
          );
        }
        return res;
      },
      findPostForScan: (scanId: string) =>
        fallbackPosts.find(
          (entry) => entry.scanId === scanId || entry.id === scanId || entry.slug === scanId,
        ),
    };
  }, [fallbackPosts, fallbackVotes, isGuest]);

  // Votes belong to an account: a guest has none, whatever the provider holds.
  const guarded = useMemo<FeedContextValue | null>(
    () => (ctx && isGuest ? { ...ctx, userVotes: [], voteFor: () => null } : ctx),
    [ctx, isGuest],
  );
  return guarded ?? fallback;
}
