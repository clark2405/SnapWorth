import { useMemo } from 'react';

import type { EstimateConfidence, ItemPhoto } from '../../components';
import { useFeed } from '../feed/feed-state';
import { useScanHistory } from '../history/scan-history-state';
import type { SavedScan } from '../history/scan-history';
import { useMarketplace } from '../marketplace/marketplace-state';
import {
  photosOf,
  previewConditions,
  previewHistory,
  previewItem,
  previewSharingByItem,
  previewValuation,
} from '../preview/sample-data';

/** Where an item lives besides History: on the feed, for sale, or sold. */
export interface ItemPlacement {
  /** The feed post and the listing it's in, when the app knows them. */
  readonly postId?: string;
  readonly listingId?: string;
  readonly onFeed?: boolean;
  readonly listed?: boolean;
  readonly sold?: boolean;
}

/** The sample's market detail: demand, a trend, recent sales and how condition moves the price. */
export interface SampleValuation {
  readonly valuation: typeof previewValuation;
  readonly conditions: typeof previewConditions;
}

/** Everything the item screen shows about one thing in History. */
export interface ItemDetail {
  readonly id: string;
  readonly title: string;
  /** What kind of thing it is, when known. */
  readonly category?: string;
  readonly estimate: number;
  readonly low: number;
  readonly high: number;
  /** How sure the AI is, when it said. */
  readonly confidence?: EstimateConfidence;
  /** The AI's reasoning, and what it assumed about the thing. */
  readonly explanation: string;
  readonly assumptions: readonly string[];
  readonly photos: readonly ItemPhoto[];
  /** When it was snapped, e.g. "Nov 7, 2026". */
  readonly capturedOn?: string;
  readonly placement: ItemPlacement;
  /** Only the sample preview has market detail; a real scan has the AI's estimate alone. */
  readonly sample?: SampleValuation;
}

export type ItemLookup =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'found'; readonly item: ItemDetail };

/** A saved scan as the item screen shows it. */
export function scanDetail(scan: SavedScan, listingId?: string, postId?: string): ItemDetail {
  return {
    id: scan.id,
    title: scan.title,
    estimate: scan.estimate,
    low: scan.lowPhp,
    high: Math.max(scan.lowPhp, scan.highPhp),
    explanation: scan.explanation,
    assumptions: scan.assumptions,
    // The uploaded photo shows on every device; the phone's own copy until then.
    photos: [{ source: { uri: scan.photoUrl ?? scan.photoUri }, label: scan.title }],
    capturedOn: scan.capturedOn,
    placement: {
      ...(listingId ? { listingId } : {}),
      ...(postId ? { postId } : {}),
      onFeed: scan.status === 'on_feed' || Boolean(postId),
      listed: scan.status === 'listed' || Boolean(listingId),
      sold: scan.status === 'sold',
    },
  };
}

/** The sample preview: one sample item, shown for any of History's sample things. */
function sampleDetail(itemId: string | undefined): ItemDetail {
  return {
    id: itemId ?? previewItem.id,
    title: previewItem.title,
    category: previewItem.category,
    estimate: previewItem.estimate,
    low: previewValuation.low,
    high: previewValuation.high,
    confidence: previewValuation.confidence,
    explanation: '',
    assumptions: [],
    photos: photosOf(previewItem),
    placement: (itemId ? previewSharingByItem[itemId] : undefined) ?? {},
    sample: { valuation: previewValuation, conditions: previewConditions },
  };
}

const sampleIds = new Set(previewHistory.map((item) => item.id));

/**
 * The thing an item screen is for: one of the account's saved scans, or, for the sample items
 * History shows before the first scan, the sample preview. With no id (a fresh snap still being
 * valued) it's the preview too. Anything else is missing, once the scans have loaded.
 */
export function useItemDetail(itemId: string | undefined): ItemLookup {
  const { scans, status } = useScanHistory();
  const { myListings: listings } = useMarketplace();
  const { findPostForScan } = useFeed();
  return useMemo<ItemLookup>(() => {
    const scan = itemId ? scans.find((entry) => entry.id === itemId) : undefined;
    if (scan) {
      const linkedListing = listings.find((entry) => entry.scanId === scan.id);
      const linkedPost = findPostForScan(scan.id);
      return {
        status: 'found',
        item: scanDetail(scan, linkedListing?.id, linkedPost?.slug || linkedPost?.id),
      };
    }
    if (!itemId || sampleIds.has(itemId)) return { status: 'found', item: sampleDetail(itemId) };
    return status === 'loading' ? { status: 'loading' } : { status: 'missing' };
  }, [findPostForScan, itemId, listings, scans, status]);
}
