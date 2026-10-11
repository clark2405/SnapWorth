import { createLucideIcon, type LucideIconNode } from 'lucide-react-native';

/**
 * SnapWorth's own glyphs, drawn on Lucide's 24-point grid and line weight so they sit beside
 * its icons and work anywhere one is taken (`icon={SnapIcon}`). They are built from the brand's
 * shapes, the price tag with its eyelet and the lens, for the places people look most: Snap,
 * the estimate, prices and the web's tab bar.
 */

/** The brand's price tag, hung at an angle: for anything priced or listed. */
export const PriceTagIcon = createLucideIcon('snapworth-price-tag', [
  [
    'path',
    {
      d: 'M2.15 17.6L4.1 9.77L14.34 4.32Q16.64 3.1 17.86 5.4L21.05 11.4Q22.27 13.7 19.97 14.92L9.73 20.36Z',
      key: 'pricetag0',
    },
  ],
  ['circle', { cx: '7.09', cy: '14.97', r: '1.7', key: 'pricetag1' }],
] satisfies LucideIconNode[]);

/** The logo in line: the tag whose eyelet is a lens. For the Snap action. */
export const SnapIcon = createLucideIcon('snapworth-snap', [
  [
    'path',
    {
      d: 'M2.85 4.35Q2.94 2.94 4.35 2.85L10.35 2.63Q11.39 2.6 12.14 3.35L20.15 11.36Q21.56 12.77 20.15 14.18L14.18 20.15Q12.77 21.56 11.36 20.15L3.35 12.14Q2.6 11.39 2.63 10.35Z',
      key: 'snap0',
    },
  ],
  ['circle', { cx: '7.43', cy: '7.43', r: '3.3', key: 'snap1' }],
  ['circle', { cx: '7.43', cy: '7.43', r: '0.6', fill: 'currentColor', key: 'snap2' }],
] satisfies LucideIconNode[]);

/** A tag with the AI's sparkle: for the estimate and anything it tells you. */
export const EstimateIcon = createLucideIcon('snapworth-estimate', [
  [
    'path',
    {
      d: 'M3.43 17.99L4.82 12.51L12.53 8.41Q14.21 7.52 15.1 9.2L17.25 13.22Q18.14 14.9 16.46 15.79L8.74 19.9Z',
      key: 'estimate0',
    },
  ],
  ['circle', { cx: '6.85', cy: '16.17', r: '1.22', key: 'estimate1' }],
  [
    'path',
    {
      d: 'M19.2 1.6Q19.2 4.8 22.4 4.8Q19.2 4.8 19.2 8Q19.2 4.8 16 4.8Q19.2 4.8 19.2 1.6Z',
      key: 'estimate2',
    },
  ],
] satisfies LucideIconNode[]);

/** A stack of posts, the front one a snapped photo. */
export const FeedIcon = createLucideIcon('snapworth-feed', [
  [
    'path',
    {
      d: 'M6.5 7.5L13.5 7.5Q16.5 7.5 16.5 10.5L16.5 17.5Q16.5 20.5 13.5 20.5L6.5 20.5Q3.5 20.5 3.5 17.5L3.5 10.5Q3.5 7.5 6.5 7.5Z',
      key: 'feed0',
    },
  ],
  ['path', { d: 'M7.5 3.5h10a3 3 0 0 1 3 3v10', key: 'feed1' }],
  ['circle', { cx: '10', cy: '14', r: '2.4', key: 'feed2' }],
] satisfies LucideIconNode[]);

/** A shopping bag with a tag's eyelet punched in its front. */
export const MarketIcon = createLucideIcon('snapworth-market', [
  ['path', { d: 'M5 8.5h14l-1 10.7a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8z', key: 'market0' }],
  ['path', { d: 'M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5', key: 'market1' }],
  ['circle', { cx: '12', cy: '13.5', r: '1.5', key: 'market2' }],
] satisfies LucideIconNode[]);

/** A speech bubble with a peso in it: where prices get talked over. */
export const ChatsIcon = createLucideIcon('snapworth-chats', [
  [
    'path',
    {
      d: 'M20.5 11.5c0 4.4-3.8 8-8.5 8-1.3 0-2.6-.3-3.7-.8L3.5 20l1.3-3.9A7.6 7.6 0 0 1 3.5 11.5c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8z',
      key: 'chats0',
    },
  ],
  ['path', { d: 'M10.5 15V8h2.2a2 2 0 0 1 0 4h-2.2M9 9.5h5.6', key: 'chats1' }],
] satisfies LucideIconNode[]);

/** Your pile: one tag laid over the edge of another. */
export const HistoryIcon = createLucideIcon('snapworth-history', [
  [
    'path',
    {
      d: 'M4.79 18.37L6.27 12.72L13.48 8.89Q15.3 7.92 16.27 9.74L18.37 13.69Q19.34 15.51 17.52 16.48L10.3 20.31Z',
      key: 'history0',
    },
  ],
  ['circle', { cx: '8.21', cy: '16.56', r: '1.29', key: 'history1' }],
  ['path', { d: 'M5.24 10.05L14.2 5.29Q16.48 4.08 17.69 6.36L20.51 11.67', key: 'history2' }],
] satisfies LucideIconNode[]);
