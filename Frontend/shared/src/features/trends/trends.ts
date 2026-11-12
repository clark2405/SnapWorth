import type { ImageSourcePropType } from 'react-native';

import type { MarketCategory, MarketListing } from '../../ports/marketplace';

/** One "Hot this month" tile: a category and how it moved. */
export interface Trend {
  readonly key: string;
  readonly label: string;
  /** How the typical asking price moved this month, e.g. "+9%". Null when it can't be told. */
  readonly change: string | null;
  readonly photo: ImageSourcePropType | null;
  /** What tapping the tile searches for in Search. */
  readonly query: string;
}

/** The story behind a trend, for its own screen. */
export interface TrendDetail {
  /** Editorial lines: only the on-device sample has them; a real trend is told by its numbers. */
  readonly headline: string | null;
  readonly why: string | null;
  readonly typicalPrice: number;
  readonly low: number;
  readonly high: number;
  /** Listings sold this month; only the on-device sample knows. */
  readonly soldThisMonth: number | null;
  /** Typical price over the last weeks, oldest first; empty when there isn't enough to draw. */
  readonly series: readonly number[];
  /** How many listings were put up in the last 30 days. Only a real trend has it. */
  readonly listedThisMonth: number | null;
  /** What the badge over the title says: "Hot this month" for the sample, else what it is. */
  readonly badge: string;
  /** What the stats call the change figure. */
  readonly changeLabel: string;
}

const dayMs = 24 * 60 * 60 * 1000;

/** How many weeks the price line looks back over, and the fewest weeks with data that draw it. */
const weeks = 12;
const fewestWeeksToDraw = 3;
/** The fewest listings in each of two months before a change between them means anything. */
const fewestForChange = 2;

export const categoryLabels: Readonly<Record<MarketCategory, string>> = {
  collectibles: 'Collectibles',
  fashion: 'Fashion',
  sneakers: 'Sneakers',
  electronics: 'Electronics',
  home: 'Home',
};

/** The middle value (the mean of the middle two for an even count). Empty is NaN: check first. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** The value a share of the way up the sorted list (0.25 is the lower quartile). */
function quantile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] as number;
}

const round10 = (value: number) => Math.round(value / 10) * 10;

function changeLabel(recent: readonly number[], earlier: readonly number[]): string | null {
  if (recent.length < fewestForChange || earlier.length < fewestForChange) return null;
  const before = median(earlier);
  if (before <= 0) return null;
  const percent = Math.round(((median(recent) - before) / before) * 100);
  return `${percent < 0 ? '−' : '+'}${Math.abs(percent)}%`;
}

export interface RealTrend {
  readonly trend: Trend;
  readonly detail: TrendDetail;
  readonly category: MarketCategory;
}

/**
 * Trends worked out from the listings people can see: for each category, what it's asking, how
 * that moved, and how many were put up this month. Ranked by listings put up in the last 30 days;
 * a category with none this month isn't trending. These are asking prices, not sale prices (a
 * sale price isn't recorded), and the change needs two or more listings in each of two months, so
 * a quiet category shows no change rather than a made-up one.
 */
export function buildTrends(
  listings: readonly MarketListing[],
  photoOf: (listing: MarketListing) => ImageSourcePropType | null,
  now: Date,
  limit = 5,
): readonly RealTrend[] {
  const at = now.getTime();
  const byCategory = new Map<MarketCategory, MarketListing[]>();
  for (const listing of listings) {
    if (listing.status !== 'active') continue;
    byCategory.set(listing.category, [...(byCategory.get(listing.category) ?? []), listing]);
  }

  const built = [...byCategory.entries()].flatMap(([category, inCategory]) => {
    const age = (listing: MarketListing) => at - Date.parse(listing.createdAt);
    const recent = inCategory.filter((listing) => age(listing) <= 30 * dayMs);
    if (recent.length === 0) return [];
    const earlier = inCategory.filter(
      (listing) => age(listing) > 30 * dayMs && age(listing) <= 60 * dayMs,
    );
    const prices = inCategory.map((listing) => listing.askingPrice);

    const weekly: number[] = [];
    for (let week = weeks - 1; week >= 0; week -= 1) {
      const inWeek = inCategory.filter(
        (listing) => age(listing) > week * 7 * dayMs && age(listing) <= (week + 1) * 7 * dayMs,
      );
      if (inWeek.length > 0) weekly.push(median(inWeek.map((listing) => listing.askingPrice)));
    }

    const newest = [...inCategory].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const label = categoryLabels[category];
    return [
      {
        listed: recent.length,
        category,
        trend: {
          key: category,
          label,
          change: changeLabel(
            recent.map((listing) => listing.askingPrice),
            earlier.map((listing) => listing.askingPrice),
          ),
          photo: newest.map(photoOf).find((photo) => photo !== null) ?? null,
          query: label,
        },
        detail: {
          headline: null,
          why: null,
          typicalPrice: round10(median(prices)),
          low: round10(quantile(prices, 0.25)),
          high: round10(quantile(prices, 0.75)),
          soldThisMonth: null,
          series: weekly.length >= fewestWeeksToDraw ? weekly.map(round10) : [],
          listedThisMonth: recent.length,
          badge: 'Listed this month',
          changeLabel: 'Change on last month',
        },
      },
    ];
  });

  return built
    .sort((a, b) => b.listed - a.listed || a.category.localeCompare(b.category))
    .slice(0, limit)
    .map(({ trend, detail, category }) => ({ trend, detail, category }));
}
