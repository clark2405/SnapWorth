import type { MarketListing } from '../../ports/marketplace';
import { buildTrends, median } from './trends';

const now = new Date('2026-11-11T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

let counter = 0;
function listing(overrides: Partial<MarketListing>): MarketListing {
  counter += 1;
  return {
    id: `l${counter}`,
    rowId: `r${counter}`,
    slug: `l${counter}`,
    scanId: null,
    title: 'Thing',
    askingPrice: 1000,
    photoUrl: null,
    photoPath: null,
    photoLabel: 'Thing',
    category: 'fashion',
    condition: 'good',
    area: 'cebu-city',
    lat: null,
    lng: null,
    description: '',
    estimatePhp: null,
    estimateLowPhp: null,
    estimateHighPhp: null,
    verdict: null,
    verdictShare: null,
    status: 'active',
    moderationStatus: 'approved',
    seller: {
      id: 's',
      handle: 'seller',
      displayName: 'Seller',
      avatarUrl: null,
      rating: null,
      sales: 0,
    },
    stats: { views: 0, saves: 0, chats: 0 },
    createdAt: daysAgo(1) as MarketListing['createdAt'],
    mine: false,
    ...overrides,
  };
}
const at = (askingPrice: number, days: number, category: MarketListing['category'] = 'fashion') =>
  listing({ askingPrice, category, createdAt: daysAgo(days) as MarketListing['createdAt'] });
const noPhoto = () => null;

describe('median', () => {
  it('is the middle value, or the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('buildTrends', () => {
  it('has nothing to say with nothing listed', () => {
    expect(buildTrends([], noPhoto, now)).toEqual([]);
  });

  it('ranks categories by what was listed in the last 30 days, and drops quiet ones', () => {
    const trends = buildTrends(
      [
        at(1000, 2, 'sneakers'),
        at(1200, 5, 'fashion'),
        at(1300, 6, 'fashion'),
        at(900, 40, 'electronics'),
      ],
      noPhoto,
      now,
    );
    expect(trends.map((entry) => entry.trend.key)).toEqual(['fashion', 'sneakers']);
  });

  it('names the category, so the tile is drawn with its artwork rather than a listing photo', () => {
    const [shoes] = buildTrends([at(1000, 2, 'sneakers')], noPhoto, now);
    expect(shoes?.trend.category).toBe('sneakers');
  });

  it('reports what listings are asking: the middle and the middle half', () => {
    const [fashion] = buildTrends(
      [at(1000, 1), at(2000, 2), at(3000, 3), at(4000, 4)],
      noPhoto,
      now,
    );
    expect(fashion?.detail.typicalPrice).toBe(2500);
    expect(fashion?.detail.low).toBe(2000);
    expect(fashion?.detail.high).toBe(4000);
    expect(fashion?.detail.listedThisMonth).toBe(4);
    // Asking prices, not sales: it says so, and there's no sold count or editorial.
    expect(fashion?.detail.soldThisMonth).toBeNull();
    expect(fashion?.detail.headline).toBeNull();
    expect(fashion?.detail.why).toBeNull();
  });

  it('shows a change only when each of two months has enough listings to compare', () => {
    const [up] = buildTrends([at(1100, 3), at(1100, 8), at(1000, 35), at(1000, 40)], noPhoto, now);
    expect(up?.trend.change).toBe('+10%');

    const [down] = buildTrends([at(900, 3), at(900, 8), at(1000, 35), at(1000, 40)], noPhoto, now);
    expect(down?.trend.change).toBe('−10%');

    const [thin] = buildTrends([at(1100, 3), at(1100, 8), at(1000, 35)], noPhoto, now);
    expect(thin?.trend.change).toBeNull();
  });

  it('draws a price line only with at least three weeks of listings', () => {
    const [few] = buildTrends([at(1000, 2), at(1100, 9)], noPhoto, now);
    expect(few?.detail.series).toEqual([]);

    const [enough] = buildTrends([at(1000, 2), at(1100, 9), at(1200, 16)], noPhoto, now);
    expect(enough?.detail.series).toEqual([1200, 1100, 1000]);
  });

  it('takes a tile’s photo from the newest listing that has one', () => {
    const newest = at(1000, 1);
    const older = at(1000, 10);
    const [trend] = buildTrends(
      [older, newest],
      (entry) => (entry === older ? { uri: 'older.jpg' } : null),
      now,
    );
    expect(trend?.trend.photo).toEqual({ uri: 'older.jpg' });
  });

  it('counts only active listings', () => {
    expect(buildTrends([listing({ status: 'sold' })], noPhoto, now)).toEqual([]);
  });

  it('keeps the few hottest', () => {
    const categories = ['collectibles', 'fashion', 'sneakers', 'electronics', 'home'] as const;
    expect(
      buildTrends(
        categories.map((category) => at(1000, 1, category)),
        noPhoto,
        now,
        3,
      ),
    ).toHaveLength(3);
  });
});
