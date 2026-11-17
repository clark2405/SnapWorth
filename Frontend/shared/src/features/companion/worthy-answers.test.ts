import type { MarketListing } from '../../ports/marketplace';
import type { SavedScan } from '../history/scan-history';
import type { Trend, TrendDetail } from '../trends/trends';
import { cardFor, contextFor, plainAnswer, subjectOf, type WorthyData } from './worthy-answers';

const scan = (id: string, title: string, estimate: number): SavedScan => ({
  id,
  title,
  estimate,
  lowPhp: estimate - 500,
  highPhp: estimate + 500,
  explanation: `${title}, judged from the photo.`,
  assumptions: [],
  photoUri: 'file:///x.jpg',
  capturedOn: 'Nov 17, 2026',
  status: 'private',
});

const walkman = scan('s-walkman', 'Sony Walkman WM-24', 3500);
const lamp = scan('s-lamp', 'Brass lamp', 1200);

const empty: WorthyData = {
  scans: [],
  listing: null,
  scan: null,
  trends: [],
  detailFor: () => undefined,
};

it('reads where the chat was opened from', () => {
  expect(subjectOf('/listing/retro-walkman')).toEqual({ kind: 'listing', id: 'retro-walkman' });
  expect(subjectOf('/item/s-lamp')).toEqual({ kind: 'item', id: 's-lamp' });
  expect(subjectOf('/feed')).toBeNull();
  expect(subjectOf(undefined)).toBeNull();
});

it('shows no card and asks for a snap when there is nothing real to go on', () => {
  for (const intent of ['price', 'listing', 'collection', 'trend'] as const) {
    expect(cardFor(intent, empty)).toBeNull();
  }
  expect(plainAnswer('listing', empty)).toMatch(/Snap the thing you want to sell first/);
  expect(plainAnswer('collection', empty)).toMatch(/History is empty/);
  // No sample numbers, ever.
  expect(plainAnswer('price', empty)).not.toMatch(/₱/);
});

it('writes a listing for the scan it was opened from, else the newest', () => {
  const data = { ...empty, scans: [walkman, lamp] };
  expect(cardFor('listing', data)).toMatchObject({ scanId: 's-walkman', price: 3500 });
  expect(cardFor('listing', { ...data, scan: lamp })).toMatchObject({ scanId: 's-lamp' });
  expect(
    cardFor('listing', data, { title: 'Walkman WM-24, red', description: 'Works.' }),
  ).toMatchObject({ title: 'Walkman WM-24, red', body: 'Works.', price: 3500 });
});

it('judges a listing’s asking price against its own AI range', () => {
  const listing = {
    title: 'Retro Walkman Player',
    askingPrice: 1900,
    estimatePhp: 3500,
    estimateLowPhp: 2000,
    estimateHighPhp: 6500,
    condition: 'good',
    mine: false,
  } as MarketListing;
  const data = { ...empty, listing };
  expect(cardFor('price', data)).toMatchObject({ low: 2000, high: 6500, asking: 1900 });
  expect(plainAnswer('price', data)).toMatch(/below its AI range/);
  // A listing without an estimate gets no invented range.
  const bare = { ...listing, estimatePhp: null, estimateLowPhp: null, estimateHighPhp: null };
  expect(cardFor('price', { ...empty, listing: bare as MarketListing })).toBeNull();
});

it('adds up the person’s own scans for their collection', () => {
  expect(cardFor('collection', { ...empty, scans: [walkman, lamp] })).toEqual({
    kind: 'portfolio',
    total: 4700,
    count: 2,
    top: { title: 'Sony Walkman WM-24', estimate: 3500 },
  });
});

it('takes the trend from the Market’s real numbers', () => {
  const trend = { key: 'electronics', label: 'Electronics', change: null } as Trend;
  const detail = { typicalPrice: 3200, listedThisMonth: 2, series: [] } as unknown as TrendDetail;
  expect(cardFor('trend', { ...empty, trends: [trend], detailFor: () => detail })).toMatchObject({
    label: 'Electronics',
    typical: 3200,
    listed: 2,
  });
});

it('tells the cloud only the person’s own things, with the subject marked', () => {
  const context = contextFor({ ...empty, scans: [walkman, lamp], scan: lamp });
  expect(context.scans.map((entry) => [entry.title, entry.subject])).toEqual([
    ['Sony Walkman WM-24', undefined],
    ['Brass lamp', true],
  ]);
});
