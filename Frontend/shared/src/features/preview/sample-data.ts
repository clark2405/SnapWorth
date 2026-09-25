/**
 * Preview content for the screens, originally taken from the Figma exports in
 * agents/designs/liquid-glass. It stands in for the feature services until they exist, and is
 * imported only by views — never by services or adapters.
 */
import type { ImageSourcePropType } from 'react-native';

import type { VoteChoice, VoteCounts } from '../../types';

import windbreakerTeal from './images/windbreaker-teal.jpg';
import windbreakerRetro from './images/windbreaker-retro.jpg';
import pufferBlack from './images/puffer-black.jpg';
import polaroidCamera from './images/polaroid-camera.jpg';
import polaroidScene from './images/polaroid-scene.jpg';
import jordanBred from './images/jordan-bred.jpg';
import walkman from './images/walkman.jpg';
import keyboard from './images/keyboard.jpg';
import avatarRetroCurator from './images/avatar-retro-curator.jpg';
import avatarMariaCruz from './images/avatar-mariacruz.jpg';
import avatarManilaHype from './images/avatar-manila-hype.jpg';
import avatarJustinV from './images/avatar-justin-v.jpg';

const image = {
  windbreakerTeal,
  windbreakerRetro,
  pufferBlack,
  polaroidCamera,
  polaroidScene,
  jordanBred,
  walkman,
  keyboard,
  avatarRetroCurator,
  avatarMariaCruz,
  avatarManilaHype,
  avatarJustinV,
};

export const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export const formatPeso = (amount: number): string => pesoFormatter.format(amount);

export interface PreviewUser {
  readonly handle: string;
  readonly avatar: ImageSourcePropType;
}

export const previewUsers = {
  retroCurator: { handle: 'retro_curator', avatar: image.avatarRetroCurator },
  mariaCruz: { handle: 'mariacruz', avatar: image.avatarMariaCruz },
  manilaHype: { handle: 'manila_hype', avatar: image.avatarManilaHype },
  justinV: { handle: 'justin_v', avatar: image.avatarJustinV },
} satisfies Record<string, PreviewUser>;

export interface PreviewPost {
  readonly id: string;
  readonly author: PreviewUser;
  readonly postedAgo: string;
  readonly body: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  /** The AI estimate the author is asking the community to judge. */
  readonly estimate: number;
  readonly votes: VoteCounts;
  readonly commentCount: number;
}

export const previewPosts: readonly PreviewPost[] = [
  {
    id: 'retro-windbreaker',
    author: previewUsers.retroCurator,
    postedAgo: '2m ago',
    body: 'Just picked up this retro 90s Nike teal windbreaker. AI valued it at ₱2,450. Is this fair? Community let me know!',
    photo: image.windbreakerTeal,
    photoLabel: 'Teal 90s Nike windbreaker laid flat on concrete',
    estimate: 2450,
    votes: { too_high: 12, just_right: 38, too_low: 4 },
    commentCount: 18,
  },
  {
    id: 'polaroid-sun-600',
    author: previewUsers.mariaCruz,
    postedAgo: '1h ago',
    body: 'Is a vintage polaroid camera worth ₱3,500? Help me out please!',
    photo: image.polaroidCamera,
    photoLabel: 'Vintage Polaroid Sun 600 camera on a table',
    estimate: 3500,
    votes: { too_high: 35, just_right: 12, too_low: 2 },
    commentCount: 42,
  },
];

export const previewPostDetail = {
  id: 'puffer-jacket',
  author: previewUsers.retroCurator,
  createdAgo: 'Post created 2h ago',
  body: 'Is ₱2,450 too high or just right for this pristine condition jacket? Help out!',
  photo: image.pufferBlack,
  photoLabel: 'Black puffer jacket laid flat',
  votes: { too_high: 12, just_right: 38, too_low: 4 } satisfies VoteCounts,
  comments: [
    {
      id: 'c1',
      author: previewUsers.manilaHype,
      body: '₱2,450 is actually extremely fair. Authentic 90s Nike sells for easily ₱3k in high-end thrift shops. Buy!',
      postedAgo: '1h ago',
      mine: true,
    },
    {
      id: 'c2',
      author: previewUsers.justinV,
      body: "If there's any stains or zip faults, it could fall closer to ₱1,800. Looks clean though!",
      postedAgo: '45m ago',
      mine: false,
    },
  ],
} as const;

export interface PreviewListing {
  readonly id: string;
  readonly title: string;
  readonly askingPrice: number;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  readonly verdict: VoteChoice;
  readonly verdictShare: number;
}

export const previewListings: readonly PreviewListing[] = [
  {
    id: 'polaroid-sun-600',
    title: 'Vintage Polaroid Sun 600',
    askingPrice: 3200,
    photo: image.polaroidCamera,
    photoLabel: 'Vintage Polaroid Sun 600 camera',
    verdict: 'just_right',
    verdictShare: 85,
  },
  {
    id: 'air-jordan-1-bred',
    title: 'Air Jordan 1 High Bred',
    askingPrice: 8500,
    photo: image.jordanBred,
    photoLabel: 'Red and black Air Jordan sneaker',
    verdict: 'too_low',
    verdictShare: 54,
  },
  {
    id: 'retro-walkman',
    title: 'Retro Walkman Player',
    askingPrice: 1900,
    photo: image.walkman,
    photoLabel: 'Silver cassette Walkman player',
    verdict: 'just_right',
    verdictShare: 92,
  },
  {
    id: 'keychron-keyboard',
    title: 'Mechanical Keychron Keyboard',
    askingPrice: 4500,
    photo: image.keyboard,
    photoLabel: 'Mechanical keyboard with RGB lighting on a desk',
    verdict: 'too_high',
    verdictShare: 60,
  },
];

export const previewListingDetail = {
  id: 'polaroid-sun-600',
  title: 'Vintage Polaroid Sun 600',
  category: 'Collectibles',
  askingPrice: 3200,
  photo: image.polaroidScene,
  photoLabel: 'Vintage Polaroid Sun 600 camera on a sunlit shelf',
  justRightShare: 85,
  assessmentNote:
    'This listing is set ₱750 above initial AI price estimate due to community vote suggestions.',
  seller: { ...previewUsers.mariaCruz, rating: '4.9', sales: 42 },
  description:
    'Perfectly functional Polaroid 600 Sun model. Tested with modern Polaroid 600 film packs. Minor cosmetic scratches on the outer plastic frame but lens is crystal clear. Original strap included.',
} as const;

export const previewItem = {
  id: 'nike-neon-windbreaker',
  title: 'Vintage Nike Neon Windbreaker',
  category: 'Apparel & Fashion',
  subtitle: 'Pristine condition • Outerwear',
  estimate: 2450,
  photo: image.windbreakerRetro,
  photoLabel: 'Teal and purple vintage Nike windbreaker',
  location: 'Metro Manila, PH',
} as const;

export interface PreviewMessage {
  readonly id: string;
  readonly body: string;
  readonly sentAt: string;
  readonly mine: boolean;
}

export const previewConversation = {
  id: 'windbreaker-chat',
  item: {
    title: 'Vintage Nike Neon Windbreaker',
    askingPrice: 2200,
    photo: image.windbreakerRetro,
  },
  messages: [
    {
      id: 'm1',
      body: 'Hi retro_curator! I saw this on the community feed. Would you accept ₱2,000 for it?',
      sentAt: '10:24 AM',
      mine: false,
    },
    {
      id: 'm2',
      body: 'Hi retro_enthusiast! I can do ₱2,100 since the condition is completely pristine. Let me know if that works!',
      sentAt: '10:26 AM',
      mine: true,
    },
    {
      id: 'm3',
      body: 'Deal! Meetup in Makati works for me. What time are you available?',
      sentAt: '10:30 AM',
      mine: false,
    },
  ] satisfies PreviewMessage[],
} as const;

export type PreviewItemStatus = 'listed' | 'on_feed' | 'private' | 'sold';

export interface PreviewHistoryItem {
  readonly id: string;
  readonly title: string;
  readonly estimate: number;
  readonly status: PreviewItemStatus;
  readonly capturedOn: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
}

export const previewHistory: readonly PreviewHistoryItem[] = [
  {
    id: 'nike-neon-windbreaker',
    title: 'Vintage Nike Neon Windbreaker',
    estimate: 2450,
    status: 'listed',
    capturedOn: 'Oct 12, 2026',
    photo: image.windbreakerRetro,
    photoLabel: 'Teal and purple vintage Nike windbreaker',
  },
  {
    id: 'polaroid-sun-600',
    title: 'Vintage Polaroid Sun 600',
    estimate: 3500,
    status: 'on_feed',
    capturedOn: 'Oct 10, 2026',
    photo: image.polaroidCamera,
    photoLabel: 'Vintage Polaroid Sun 600 camera',
  },
  {
    id: 'retro-denim-jacket',
    title: 'Pristine Retro Denim Jacket',
    estimate: 1800,
    status: 'private',
    capturedOn: 'Oct 05, 2026',
    // The design reuses the Polaroid shot here; swap in a denim photo when real data exists.
    photo: image.polaroidScene,
    photoLabel: 'Photo of the retro denim jacket listing',
  },
  {
    id: 'air-jordan-1-retro',
    title: 'Air Jordan 1 Retro High',
    estimate: 7500,
    status: 'sold',
    capturedOn: 'Sep 28, 2026',
    photo: image.jordanBred,
    photoLabel: 'Red and black Air Jordan sneaker',
  },
];

/** The signed-in user in preview mode. `isAdmin` shows the moderation entry on the profile. */
export const previewProfile = {
  user: previewUsers.retroCurator,
  displayName: 'Rico Santos',
  joined: 'Joined March 2026',
  location: 'Makati, Metro Manila',
  rating: '4.8',
  stats: { checked: previewHistory.length, listed: 1, sold: 12 },
  isAdmin: true,
} as const;

export interface PreviewConversationSummary {
  readonly id: string;
  readonly with: PreviewUser;
  readonly itemTitle: string;
  readonly itemPhoto: ImageSourcePropType;
  readonly lastMessage: string;
  readonly lastFromMe: boolean;
  readonly sentAt: string;
  readonly unread: number;
}

export const previewConversations: readonly PreviewConversationSummary[] = [
  {
    id: 'windbreaker-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Vintage Nike Neon Windbreaker',
    itemPhoto: image.windbreakerRetro,
    lastMessage: 'Deal! Meetup in Makati works for me. What time are you available?',
    lastFromMe: false,
    sentAt: '10:30 AM',
    unread: 2,
  },
  {
    id: 'polaroid-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Vintage Polaroid Sun 600',
    itemPhoto: image.polaroidCamera,
    lastMessage: 'Does it come with the original strap?',
    lastFromMe: true,
    sentAt: 'Yesterday',
    unread: 0,
  },
  {
    id: 'jordan-chat',
    with: previewUsers.justinV,
    itemTitle: 'Air Jordan 1 Retro High',
    itemPhoto: image.jordanBred,
    lastMessage: 'Thanks, received them today. Great condition.',
    lastFromMe: false,
    sentAt: 'Sep 28',
    unread: 0,
  },
];

export interface PreviewSeller {
  readonly user: PreviewUser;
  readonly displayName: string;
  readonly rating: string;
  readonly sales: number;
  readonly joined: string;
  readonly bio: string;
  readonly listingIds: readonly string[];
}

export const previewSellers: Readonly<Record<string, PreviewSeller>> = {
  mariacruz: {
    user: previewUsers.mariaCruz,
    displayName: 'Maria Cruz',
    rating: '4.9',
    sales: 42,
    joined: 'Joined January 2026',
    bio: 'Film cameras and 90s electronics. Everything is tested before it is listed.',
    listingIds: ['polaroid-sun-600', 'retro-walkman'],
  },
};

export type PreviewHeldKind = 'post' | 'comment';

export interface PreviewHeldContent {
  readonly id: string;
  readonly kind: PreviewHeldKind;
  readonly author: PreviewUser;
  readonly body: string;
  readonly reason: string;
  readonly heldAgo: string;
  readonly reports: number;
  readonly photo?: ImageSourcePropType;
  readonly photoLabel?: string;
}

// Ordered most urgent first: most reports, then oldest.
export const previewHeldContent: readonly PreviewHeldContent[] = [
  {
    id: 'held-1',
    kind: 'comment',
    author: previewUsers.justinV,
    body: 'This is obviously fake, the seller is scamming everyone here.',
    reason: 'Reported for harassment',
    heldAgo: '3h ago',
    reports: 4,
  },
  {
    id: 'held-2',
    kind: 'post',
    author: previewUsers.manilaHype,
    body: 'DM me for cheaper prices, selling outside the app.',
    reason: 'Flagged by moderation: off-platform sale',
    heldAgo: '1h ago',
    reports: 2,
    photo: image.keyboard,
    photoLabel: 'Mechanical keyboard with RGB lighting on a desk',
  },
];

export const previewRecentSearches: readonly string[] = ['Polaroid', 'Nike windbreaker', 'Jordan'];

export interface PreviewSearchResult {
  readonly id: string;
  readonly kind: 'listing' | 'post' | 'item';
  readonly title: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  /** Asking price for listings; AI estimate for posts and history items. */
  readonly amount: number;
}

export const previewSearchIndex: readonly PreviewSearchResult[] = [
  ...previewListings.map((listing) => ({
    id: listing.id,
    kind: 'listing' as const,
    title: listing.title,
    photo: listing.photo,
    photoLabel: listing.photoLabel,
    amount: listing.askingPrice,
  })),
  ...previewPosts.map((post) => ({
    id: post.id,
    kind: 'post' as const,
    title: post.body,
    photo: post.photo,
    photoLabel: post.photoLabel,
    amount: post.estimate,
  })),
  ...previewHistory.map((item) => ({
    id: item.id,
    kind: 'item' as const,
    title: item.title,
    photo: item.photo,
    photoLabel: item.photoLabel,
    amount: item.estimate,
  })),
];

/*
 * Valuation depth, from the competitive review (FlipAI, PriceSnap, Value Scout, StockX,
 * CardLadder): an estimate is a range with a stated confidence, backed by comparable sales,
 * adjusted by condition, and tracked over time. All of it is preview data until the pricing
 * service returns these fields.
 */

export type PreviewConfidence = 'high' | 'medium' | 'low';
export type PreviewCondition = 'new' | 'like_new' | 'good' | 'fair';

export const previewConditions: readonly {
  readonly key: PreviewCondition;
  readonly label: string;
  /** Multiplier applied to the good-condition estimate. */
  readonly factor: number;
  readonly hint: string;
}[] = [
  { key: 'new', label: 'New', factor: 1.28, hint: 'Unworn, tags or box included' },
  { key: 'like_new', label: 'Like new', factor: 1.12, hint: 'No visible wear' },
  { key: 'good', label: 'Good', factor: 1, hint: 'Light, honest wear' },
  { key: 'fair', label: 'Fair', factor: 0.74, hint: 'Marks, fading, or repairs' },
];

export interface PreviewComparable {
  readonly id: string;
  readonly title: string;
  readonly price: number;
  readonly soldAgo: string;
  readonly source: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
}

export const previewValuation = {
  itemId: 'nike-neon-windbreaker',
  low: 2100,
  high: 2850,
  confidence: 'high' as PreviewConfidence,
  condition: 'like_new' as PreviewCondition,
  demand: 'High demand',
  demandDetail: '14 sold in the last 30 days',
  sellTime: 'Sells in ~6 days',
  rarity: 'Uncommon colourway',
  /** Estimated value over the last 12 weeks, oldest first. */
  trend: [1980, 2020, 2100, 2060, 2150, 2210, 2190, 2280, 2330, 2310, 2400, 2450],
  trendChange: '+12% in 3 months',
  comparables: [
    {
      id: 'comp-1',
      title: 'Nike 90s Windbreaker, teal/purple',
      price: 2600,
      soldAgo: 'Sold 4 days ago',
      source: 'Carousell',
      photo: image.windbreakerTeal,
      photoLabel: 'Teal 90s Nike windbreaker',
    },
    {
      id: 'comp-2',
      title: 'Vintage Nike Spellout Shell Jacket',
      price: 2300,
      soldAgo: 'Sold 1 week ago',
      source: 'SnapWorth',
      photo: image.windbreakerRetro,
      photoLabel: 'Retro Nike windbreaker',
    },
    {
      id: 'comp-3',
      title: 'Nike Track Jacket, 1994',
      price: 2150,
      soldAgo: 'Sold 2 weeks ago',
      source: 'Facebook Marketplace',
      photo: image.pufferBlack,
      photoLabel: 'Black Nike jacket',
    },
  ] satisfies PreviewComparable[],
} as const;

/** The user's collection: everything they have valued and still own. */
export const previewPortfolio = {
  total: 15250,
  itemCount: 4,
  change: 1180,
  changeLabel: '+8.4% this month',
  series: [12400, 12650, 12900, 12800, 13300, 13550, 13400, 13900, 14300, 14650, 14900, 15250],
  topMover: { title: 'Vintage Polaroid Sun 600', change: '+₱400' },
} as const;

export const previewTrending: readonly {
  readonly key: string;
  readonly label: string;
  readonly change: string;
  readonly photo: ImageSourcePropType;
}[] = [
  { key: 'film-cameras', label: 'Film cameras', change: '+18%', photo: image.polaroidCamera },
  { key: 'sneakers', label: 'Sneakers', change: '+9%', photo: image.jordanBred },
  { key: '90s-sportswear', label: '90s sportswear', change: '+14%', photo: image.windbreakerTeal },
  { key: 'retro-audio', label: 'Retro audio', change: '+6%', photo: image.walkman },
  { key: 'keyboards', label: 'Keyboards', change: '−3%', photo: image.keyboard },
];

export const previewMarketCategories: readonly { readonly key: string; readonly label: string }[] =
  [
    { key: 'all', label: 'All' },
    { key: 'collectibles', label: 'Collectibles' },
    { key: 'fashion', label: 'Fashion' },
    { key: 'sneakers', label: 'Sneakers' },
    { key: 'electronics', label: 'Electronics' },
    { key: 'home', label: 'Home' },
  ];

/** Market context for a listing: its AI range and quick offers a buyer can send. */
export const previewListingInsight = {
  listingId: 'polaroid-sun-600',
  estimateLow: 2300,
  estimateHigh: 3100,
  estimate: 2750,
  confidence: 'medium' as PreviewConfidence,
  offerSuggestions: [2800, 2950, 3100],
  watchers: 23,
} as const;

/** Worthy's canned knowledge for preview mode, keyed by what the question is about. */
export const previewCompanionReplies = {
  fairPrice:
    'Looking at 14 similar sales this month, the fair range is ₱2,300–₱3,100. At ₱3,200 this is a touch above the top of the range — an offer around ₱2,900 is reasonable and likely to be accepted.',
  listing:
    'Here is a listing draft. I led with the colourway and the condition, since those are what buyers of vintage Nike search for.',
  listingDraft: {
    title: 'Vintage 90s Nike Windbreaker — Teal/Purple, Like New',
    body: 'Authentic early-90s Nike shell jacket in the teal and purple colourway. Like-new condition: bright colours, working zip, no stains or tears. Size L, fits true to size. Meet-ups in Makati or shipping nationwide.',
    price: 2650,
  },
  trend:
    'Vintage sportswear has been climbing steadily — up 12% over three months, with film cameras rising even faster. Good time to sell if you have been holding.',
  fallback:
    'Good question. From what I can see in recent SnapWorth sales and community votes, here is my read — and I can dig deeper if you snap a photo.',
} as const;
