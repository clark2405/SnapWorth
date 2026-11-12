import type { ImageSourcePropType } from 'react-native';

import type { FeedPost, UserVoteRecord } from '../../ports/feed';
import type { MarketCategory } from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import {
  previewAvatarByHandle,
  previewItem,
  previewOlderPosts,
  previewPhotoByListingKey,
  previewPosts as bundledPreviewPosts,
  previewVotesCast,
  type PreviewPost,
} from '../preview/sample-data';

// The Feed's sample content, for the app running alone on a device (no Supabase project): the
// on-device feed repository starts from it. With a project, none of it is read.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a post was made on this device (a sample, or one posted here): Supabase's ids are uuids. */
export const isDevicePost = (post: { readonly id: string }): boolean => !uuidPattern.test(post.id);

const bundledPostsAll: readonly PreviewPost[] = [...bundledPreviewPosts, ...previewOlderPosts];

const bundledPostByKey: Readonly<Record<string, PreviewPost>> = Object.fromEntries(
  bundledPostsAll.map((post) => [post.id, post]),
);

const bundledCategoryBySlug: Readonly<Record<string, MarketCategory>> = {
  'retro-windbreaker': 'fashion',
  'polaroid-sun-600': 'collectibles',
  'retro-walkman-post': 'electronics',
  'keychron-post': 'electronics',
};

const bundledCreatedOffsetMs: Readonly<Record<string, number>> = {
  'retro-windbreaker': 2 * 60 * 1000,
  'polaroid-sun-600': 60 * 60 * 1000,
  'retro-walkman-post': 3 * 24 * 60 * 60 * 1000,
  'keychron-post': 5 * 24 * 60 * 60 * 1000,
};

/** The sample post with this key, with its bundled photo and discussion. */
export function sampleFeedPost(key: string): PreviewPost | undefined {
  return bundledPostByKey[key];
}

/**
 * The bundled photo for a post made on this device: its sample's, or that of the sample listing
 * it reposts. A post from Supabase never gets one (it has its scan's photo, or none).
 */
export function sampleFeedPhoto(post: {
  readonly id: string;
  readonly listing?: { readonly slug?: string; readonly id?: string } | null;
}): ImageSourcePropType {
  const own = bundledPostByKey[post.id];
  if (own?.photo) return own.photo;
  const keys = [post.listing?.slug, post.listing?.id].filter((entry): entry is string =>
    Boolean(entry),
  );
  for (const key of keys) {
    const photo = previewPhotoByListingKey[key];
    if (photo) return photo;
  }
  return previewItem.photo;
}

/** The bundled avatar of a sample person, by handle. */
export function sampleAvatarFor(handle: string): ImageSourcePropType | null {
  return previewAvatarByHandle[handle.replace(/^@/, '').toLowerCase()] ?? null;
}

export function buildPreviewFeedPosts(): readonly FeedPost[] {
  const now = Date.now();
  return bundledPostsAll.map((post, index) => {
    const offset = bundledCreatedOffsetMs[post.id] ?? (index + 1) * 3600_000;
    return {
      id: post.id,
      slug: post.id,
      title: post.photoLabel,
      category: bundledCategoryBySlug[post.id] ?? 'collectibles',
      body: post.body,
      estimate: post.estimate,
      photoUrl: null,
      photoLabel: post.photoLabel,
      votes: post.votes,
      moderationStatus: 'approved',
      createdAt: new Date(now - offset).toISOString() as UtcDateTime,
      author: {
        userId: `preview:${post.author.handle}`,
        handle: post.author.handle,
        avatarUrl: null,
      },
      scanId: post.id === 'polaroid-sun-600' ? 'polaroid-sun-600' : null,
      listing: post.listing
        ? {
            id: post.listing.id,
            slug: post.listing.id,
            askingPrice: post.listing.askingPrice,
          }
        : null,
      isMine: post.author.handle === 'retro_curator',
    };
  });
}

export function buildPreviewFeedVotes(): readonly UserVoteRecord[] {
  const now = Date.now();
  return previewVotesCast.map((entry, index) => ({
    postId: entry.postId,
    postSlug: entry.postId,
    choice: entry.vote,
    castAt: new Date(now - (index + 1) * 40 * 60 * 1000).toISOString() as UtcDateTime,
  }));
}
