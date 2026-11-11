import { useMemo } from 'react';

import type { FeedPost } from '../../ports/feed';
import type { MarketCategory, MarketListing } from '../../ports/marketplace';
import { useFeed } from '../feed/feed-state';
import { listingPhotoSource, useMarketplace } from '../marketplace/marketplace-state';
import { previewTrendDetails, previewTrending } from '../preview/sample-data';
import { useBackendMode } from '../session/backend-mode';
import { buildTrends, type Trend, type TrendDetail } from './trends';

export interface Trends {
  /** What the Feed's row of tiles is called. */
  readonly heading: string;
  /** The "Hot this month" tiles, hottest first. Empty when nothing is trending. */
  readonly trends: readonly Trend[];
  readonly detailFor: (key: string) => TrendDetail | undefined;
  /** The listings and feed posts that belong to a trend. */
  readonly listingsFor: (key: string) => readonly MarketListing[];
  readonly postsFor: (key: string) => readonly FeedPost[];
}

/** What each sample trend's search tile looks for; categories are broader than any one title. */
const sampleQuery: Readonly<Record<string, string>> = {
  'film-cameras': 'Polaroid',
  sneakers: 'Jordan',
  '90s-sportswear': 'Windbreaker',
  'retro-audio': 'Walkman',
  keyboards: 'Keyboard',
};

const sampleCategoryByKey: Readonly<Record<string, MarketCategory>> = {
  'film-cameras': 'collectibles',
  sneakers: 'sneakers',
  '90s-sportswear': 'fashion',
  'retro-audio': 'electronics',
  keyboards: 'electronics',
};

/**
 * The trends the app shows. With a Supabase project they are worked out from the real listings
 * (`buildTrends`); with none, the on-device sample trends and their stories, so the app can be
 * tried out. The sample's numbers never show with a project.
 */
export function useTrends(): Trends {
  const mode = useBackendMode();
  const { listings } = useMarketplace();
  const { posts } = useFeed();

  return useMemo<Trends>(() => {
    if (mode === 'supabase') {
      const real = buildTrends(listings, listingPhotoSource, new Date());
      const categoryOf = (key: string) => real.find((entry) => entry.trend.key === key)?.category;
      return {
        heading: 'Most listed this month',
        trends: real.map((entry) => entry.trend),
        detailFor: (key) => real.find((entry) => entry.trend.key === key)?.detail,
        listingsFor: (key) => listings.filter((listing) => listing.category === categoryOf(key)),
        postsFor: (key) => posts.filter((post) => post.category === categoryOf(key)),
      };
    }
    return {
      heading: 'Hot this month',
      trends: previewTrending.map((entry) => ({
        key: entry.key,
        label: entry.label,
        change: entry.change,
        photo: entry.photo,
        query: sampleQuery[entry.key] ?? entry.label,
      })),
      detailFor: (key) => {
        const detail = previewTrendDetails[key];
        return detail
          ? {
              headline: detail.headline,
              why: detail.why,
              typicalPrice: detail.typicalPrice,
              low: detail.low,
              high: detail.high,
              soldThisMonth: detail.soldThisMonth,
              series: detail.series,
              listedThisMonth: null,
              badge: 'Hot this month',
              changeLabel: '12-week change',
            }
          : undefined;
      },
      listingsFor: (key) => {
        const detail = previewTrendDetails[key];
        const category = sampleCategoryByKey[key];
        if (!detail) return [];
        return listings.filter(
          (listing) =>
            detail.listingIds.includes(listing.id) ||
            detail.listingIds.includes(listing.slug) ||
            (category !== undefined &&
              listing.category === category &&
              !Object.values(previewTrendDetails).some(
                (other) => other !== detail && other.listingIds.includes(listing.id),
              )),
        );
      },
      postsFor: (key) => {
        const detail = previewTrendDetails[key];
        const category = sampleCategoryByKey[key];
        if (!detail) return [];
        return posts.filter(
          (post) =>
            detail.postIds.includes(post.id) ||
            detail.postIds.includes(post.slug) ||
            (category !== undefined &&
              post.category === category &&
              !Object.values(previewTrendDetails).some(
                (other) => other !== detail && other.postIds.includes(post.slug),
              )),
        );
      },
    };
  }, [listings, mode, posts]);
}
