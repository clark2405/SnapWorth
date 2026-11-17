import type { MarketListing } from '../../ports/marketplace';
import type { WorthyContext } from '../../ports/worthy';
import type { SavedScan } from '../history/scan-history';
import type { Trend, TrendDetail } from '../trends/trends';
import { formatPeso } from '../preview/sample-data';
import type { WorthyIntent } from './worthy-replies';

/**
 * The evidence beneath one of Worthy's answers, from the app's own data: never a sample. Each
 * card is built from the person's scans, the listing they're looking at, or the Market's real
 * trends, and there's no card when there's nothing real to show.
 */
export type ReplyCard =
  | {
      readonly kind: 'range';
      readonly title: string;
      readonly estimate: number;
      readonly low: number;
      readonly high: number;
      /** The seller's asking price, when the question is about a listing. */
      readonly asking: number | null;
    }
  | {
      readonly kind: 'listing';
      readonly scanId: string;
      readonly title: string;
      readonly body: string;
      readonly price: number;
    }
  | {
      readonly kind: 'trend';
      readonly label: string;
      readonly typical: number;
      readonly listed: number | null;
      readonly change: string | null;
      readonly series: readonly number[];
    }
  | {
      readonly kind: 'portfolio';
      readonly total: number;
      readonly count: number;
      readonly top: { readonly title: string; readonly estimate: number } | null;
    };

/** What Worthy knows to answer from. */
export interface WorthyData {
  /** The person's saved scans, newest first. */
  readonly scans: readonly SavedScan[];
  /** The listing the chat was opened from, if any. */
  readonly listing: MarketListing | null;
  /** The scan the chat was opened from, if any (else their newest is the subject). */
  readonly scan: SavedScan | null;
  readonly trends: readonly Trend[];
  readonly detailFor: (key: string) => TrendDetail | undefined;
}

/** Where the chat was opened, as the route it was opened from: `/listing/<slug>` or `/item/<id>`. */
export function subjectOf(
  about: string | undefined,
): { readonly kind: 'listing' | 'item'; readonly id: string } | null {
  const match = /^\/(listing|item)\/([^/?#]+)/.exec(about ?? '');
  return match ? { kind: match[1] as 'listing' | 'item', id: decodeURIComponent(match[2]!) } : null;
}

/** The scan a question is about: the one the chat was opened from, else the newest. */
function subjectScan(data: WorthyData): SavedScan | null {
  return data.scan ?? data.scans[0] ?? null;
}

/** The card for an intent, built only from real data. */
export function cardFor(
  intent: WorthyIntent,
  data: WorthyData,
  draft?: { readonly title: string; readonly description: string } | null,
): ReplyCard | null {
  switch (intent) {
    case 'price': {
      const listing = data.listing;
      if (
        listing &&
        listing.estimatePhp !== null &&
        listing.estimateLowPhp !== null &&
        listing.estimateHighPhp !== null
      ) {
        return {
          kind: 'range',
          title: listing.title,
          estimate: listing.estimatePhp,
          low: listing.estimateLowPhp,
          high: listing.estimateHighPhp,
          asking: listing.askingPrice,
        };
      }
      if (listing) return null;
      const scan = subjectScan(data);
      return scan
        ? {
            kind: 'range',
            title: scan.title,
            estimate: scan.estimate,
            low: scan.lowPhp,
            high: scan.highPhp,
            asking: null,
          }
        : null;
    }
    case 'listing': {
      const scan = subjectScan(data);
      if (!scan) return null;
      return {
        kind: 'listing',
        scanId: scan.id,
        title: draft?.title ?? scan.title,
        body: draft?.description ?? scan.explanation,
        price: scan.estimate,
      };
    }
    case 'trend': {
      const top = data.trends[0];
      const detail = top ? data.detailFor(top.key) : undefined;
      if (!top || !detail) return null;
      return {
        kind: 'trend',
        label: top.label,
        typical: detail.typicalPrice,
        listed: detail.listedThisMonth,
        change: top.change,
        series: detail.series,
      };
    }
    case 'collection': {
      if (data.scans.length === 0) return null;
      const top = [...data.scans].sort((a, b) => b.estimate - a.estimate)[0]!;
      return {
        kind: 'portfolio',
        total: data.scans.reduce((sum, scan) => sum + scan.estimate, 0),
        count: data.scans.length,
        top: { title: top.title, estimate: top.estimate },
      };
    }
    case 'chat':
      return null;
  }
}

/**
 * What Worthy says when no model answered (no backend, offline, or the cloud refused): plain
 * sentences from the same data as the card, or what's needed when there's nothing to go on.
 */
export function plainAnswer(intent: WorthyIntent, data: WorthyData): string {
  const card = cardFor(intent, data);
  switch (intent) {
    case 'price':
      if (card?.kind === 'range' && card.asking !== null) {
        const verdict =
          card.asking > card.high
            ? 'above its AI range'
            : card.asking < card.low
              ? 'below its AI range, a good deal if it checks out'
              : 'inside its AI range';
        return `${card.title} is asking ${formatPeso(card.asking)}, ${verdict} of ${formatPeso(card.low)}–${formatPeso(card.high)}. That range is a rough AI guess, not a sale price.`;
      }
      if (card?.kind === 'range') {
        return `Your ${card.title} is estimated at about ${formatPeso(card.estimate)}, likely ${formatPeso(card.low)}–${formatPeso(card.high)}. It's a rough AI guess, so a community vote can tell you more.`;
      }
      return data.listing
        ? 'This listing has no AI estimate yet, so I have nothing fair to compare its price with. The community vote on it is your best guide.'
        : 'Snap the item first and I’ll tell you what it’s likely worth.';
    case 'listing':
      return card
        ? `Here’s a start for your ${card.kind === 'listing' ? card.title : 'item'}, priced at its AI estimate. Check the details before you publish.`
        : 'Snap the thing you want to sell first, then I can write its listing from what the AI saw.';
    case 'trend':
      return card?.kind === 'trend'
        ? `${card.label} is what people are listing most this month, typically asking around ${formatPeso(card.typical)}.`
        : 'Not much has been listed this month yet, so there’s no trend I can point to honestly.';
    case 'collection':
      return card?.kind === 'portfolio'
        ? `Your ${card.count === 1 ? 'one item is' : `${card.count} items are`} worth about ${formatPeso(card.total)} together, going by their AI estimates.${card.top ? ` ${card.top.title} is worth the most.` : ''}`
        : 'Your History is empty so far. Snap a few things and I’ll add them up.';
    case 'chat':
      return 'I can price what you snap, check whether an asking price is fair, write your listing, and tell you what’s being listed most. What would you like?';
  }
}

/** What the cloud is told: the person's own things, cut down, with the subject marked. */
export function contextFor(data: WorthyData): WorthyContext {
  const subject = subjectScan(data);
  return {
    scans: data.scans.slice(0, 12).map((scan) => ({
      title: scan.title,
      estimatePhp: scan.estimate,
      lowPhp: scan.lowPhp,
      highPhp: scan.highPhp,
      note: scan.explanation.slice(0, 300),
      status: scan.status,
      subject: scan.id === subject?.id || undefined,
    })),
    listing: data.listing
      ? {
          title: data.listing.title,
          askingPhp: data.listing.askingPrice,
          estimatePhp: data.listing.estimatePhp,
          lowPhp: data.listing.estimateLowPhp,
          highPhp: data.listing.estimateHighPhp,
          condition: data.listing.condition,
          mine: data.listing.mine,
        }
      : undefined,
    trends: data.trends.slice(0, 5).flatMap((trend) => {
      const detail = data.detailFor(trend.key);
      return detail
        ? [
            {
              category: trend.label,
              typicalAskingPhp: detail.typicalPrice,
              listedThisMonth: detail.listedThisMonth ?? 0,
              change: trend.change,
            },
          ]
        : [];
    }),
  };
}
