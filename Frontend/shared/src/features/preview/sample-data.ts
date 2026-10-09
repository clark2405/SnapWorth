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

/** Avatars for the demo accounts by handle. The backend's seed uses the same handles. */
export const previewAvatarByHandle: Readonly<Record<string, ImageSourcePropType>> =
  Object.fromEntries(Object.values(previewUsers).map((user) => [user.handle, user.avatar]));

export interface PreviewComment {
  readonly id: string;
  /** The comment this one replies to, if any. */
  readonly replyTo?: string;
  readonly author: PreviewUser;
  readonly body: string;
  readonly postedAgo: string;
}

/** One of an item's photos (an item can carry up to `maxItemPhotos`), cover first. */
export interface PreviewPhoto {
  readonly source: ImageSourcePropType;
  readonly label: string;
}

/** How many photos an item can carry: the cover plus three more angles. */
export const maxItemPhotos = 4;

/** Every photo of an entry, cover first: its `photos` when it has several, else its one photo. */
export function photosOf(entry: {
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  readonly photos?: readonly PreviewPhoto[];
}): readonly PreviewPhoto[] {
  return entry.photos?.length
    ? entry.photos.slice(0, maxItemPhotos)
    : [{ source: entry.photo, label: entry.photoLabel }];
}

export interface PreviewPost {
  readonly id: string;
  readonly author: PreviewUser;
  readonly postedAgo: string;
  readonly body: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  /** More angles of the item, cover first, when the author added them. */
  readonly photos?: readonly PreviewPhoto[];
  /** The AI estimate the author is asking the community to judge. */
  readonly estimate: number;
  readonly votes: VoteCounts;
  readonly comments: readonly PreviewComment[];
  /** Set when the post is a marketplace listing reposted to ask whether its price is fair. */
  readonly listing?: { readonly id: string; readonly askingPrice: number };
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
    comments: [
      {
        id: 'windbreaker-c1',
        author: previewUsers.manilaHype,
        body: 'Teal colourways go fast. ₱2,450 is fair, maybe even a little low.',
        postedAgo: '1m ago',
      },
      {
        id: 'windbreaker-c2',
        author: previewUsers.justinV,
        body: 'Check the inner tag. If it says "Made in Korea" it could be worth more.',
        postedAgo: '2m ago',
      },
    ],
  },
  {
    id: 'polaroid-sun-600',
    author: previewUsers.mariaCruz,
    postedAgo: '1h ago',
    body: 'Is a vintage polaroid camera worth ₱3,500? Help me out please!',
    photo: image.polaroidCamera,
    photoLabel: 'Vintage Polaroid Sun 600 camera on a table',
    photos: [
      { source: image.polaroidCamera, label: 'Vintage Polaroid Sun 600 camera on a table' },
      { source: image.polaroidScene, label: 'The same Polaroid on a sunlit shelf' },
    ],
    estimate: 3500,
    votes: { too_high: 35, just_right: 12, too_low: 2 },
    listing: { id: 'polaroid-sun-600', askingPrice: 3200 },
    comments: [
      {
        id: 'polaroid-c4',
        replyTo: 'polaroid-c3',
        author: previewUsers.mariaCruz,
        body: 'Good to know, thanks. It does come with one sealed pack of film.',
        postedAgo: '40m ago',
      },
      {
        id: 'polaroid-c3',
        author: previewUsers.retroCurator,
        body: 'Agree with the others. I would list it around ₱2,900.',
        postedAgo: '12m ago',
      },
      {
        id: 'polaroid-c2',
        author: previewUsers.manilaHype,
        body: 'Test the flash first. A working one is worth the extra.',
        postedAgo: '30m ago',
      },
      {
        id: 'polaroid-c1',
        author: previewUsers.justinV,
        body: 'Sun 600s usually go for ₱2,500 to ₱3,000 here. ₱3,500 feels high unless it comes with film.',
        postedAgo: '48m ago',
      },
    ],
  },
];

/** Older posts, further down the preview feed below `previewPosts`. */
export const previewOlderPosts: readonly PreviewPost[] = [
  {
    id: 'retro-walkman-post',
    author: previewUsers.justinV,
    postedAgo: '3d ago',
    body: 'Found my dad’s old Walkman. AI says ₱1,900. Would you pay that?',
    photo: image.walkman,
    photoLabel: 'Silver cassette Walkman player',
    estimate: 1900,
    votes: { too_high: 6, just_right: 41, too_low: 9 },
    comments: [],
  },
  {
    id: 'keychron-post',
    author: previewUsers.manilaHype,
    postedAgo: '5d ago',
    body: 'Listing my Keychron at ₱4,500. Too much for a used board?',
    photo: image.keyboard,
    photoLabel: 'Mechanical keyboard with RGB lighting on a desk',
    estimate: 3900,
    votes: { too_high: 28, just_right: 14, too_low: 3 },
    comments: [],
  },
];

/** Every vote the viewer has cast, newest first: part of the account's running history. */
export const previewVotesCast: readonly {
  readonly postId: string;
  readonly vote: VoteChoice;
  readonly castAgo: string;
}[] = [
  { postId: 'polaroid-sun-600', vote: 'too_high', castAgo: '40m ago' },
  { postId: 'retro-walkman-post', vote: 'just_right', castAgo: '2d ago' },
  { postId: 'keychron-post', vote: 'just_right', castAgo: '4d ago' },
];

/** Shown when a post link points at a post that is not in the preview feed. */
export const previewPostDetail: PreviewPost = {
  id: 'puffer-jacket',
  author: previewUsers.retroCurator,
  postedAgo: '2h ago',
  body: 'Is ₱2,450 too high or just right for this pristine condition jacket? Help out!',
  photo: image.pufferBlack,
  photoLabel: 'Black puffer jacket laid flat',
  estimate: 2450,
  votes: { too_high: 12, just_right: 38, too_low: 4 },
  comments: [
    {
      id: 'c2',
      author: previewUsers.justinV,
      body: "If there's any stains or zip faults, it could fall closer to ₱1,800. Looks clean though!",
      postedAgo: '45m ago',
    },
    {
      id: 'c1',
      author: previewUsers.manilaHype,
      body: '₱2,450 is actually extremely fair. Authentic 90s Nike sells for easily ₱3k in high-end thrift shops. Buy!',
      postedAgo: '1h ago',
    },
  ],
};

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
  {
    id: 'nike-teal-windbreaker',
    title: 'Retro Nike Teal Windbreaker',
    askingPrice: 2600,
    photo: image.windbreakerTeal,
    photoLabel: 'Teal Nike half-zip windbreaker on concrete',
    verdict: 'too_high',
    verdictShare: 58,
  },
  {
    id: 'colour-block-windbreaker',
    title: '90s Colour-Block Windbreaker',
    askingPrice: 1950,
    photo: image.windbreakerRetro,
    photoLabel: 'Teal and purple colour-block windbreaker',
    verdict: 'too_low',
    verdictShare: 66,
  },
  {
    id: 'black-puffer-jacket',
    title: 'Black Quilted Puffer Jacket',
    askingPrice: 2900,
    photo: image.pufferBlack,
    photoLabel: 'Black quilted puffer jacket',
    verdict: 'just_right',
    verdictShare: 74,
  },
  {
    id: 'polaroid-film-bundle',
    title: 'Polaroid Camera and Film Bundle',
    askingPrice: 3800,
    photo: image.polaroidScene,
    photoLabel: 'Polaroid camera on a shelf beside a plant',
    verdict: 'just_right',
    verdictShare: 69,
  },
];

export const previewListingDetail = {
  id: 'polaroid-sun-600',
  title: 'Vintage Polaroid Sun 600',
  category: 'Collectibles',
  askingPrice: 3200,
  photo: image.polaroidScene,
  photoLabel: 'Vintage Polaroid Sun 600 camera on a sunlit shelf',
  photos: [
    { source: image.polaroidScene, label: 'Vintage Polaroid Sun 600 camera on a sunlit shelf' },
    { source: image.polaroidCamera, label: 'The Polaroid from the front, lens and flash' },
  ],
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

/** A structured price offer inside a chat. `countered` means a newer offer replaced it. */
export type PreviewOfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

export interface PreviewOffer {
  readonly amount: number;
  readonly status: PreviewOfferStatus;
}

/** A proposed pickup or handoff: where and when, and whether the other side has agreed. */
export interface PreviewMeetup {
  readonly place: string;
  readonly when: string;
  readonly status: 'proposed' | 'confirmed';
}

export interface PreviewMessage {
  readonly id: string;
  readonly body: string;
  readonly sentAt: string;
  readonly mine: boolean;
  readonly offer?: PreviewOffer;
  readonly meetup?: PreviewMeetup;
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
      body: 'Hi retro_curator! I saw this on the community feed. Is it still available?',
      sentAt: '10:22 AM',
      mine: false,
    },
    {
      id: 'm2',
      body: 'Would you accept ₱2,000 for it?',
      sentAt: '10:24 AM',
      mine: false,
      offer: { amount: 2000, status: 'countered' },
    },
    {
      id: 'm3',
      body: 'I can do ₱2,100 since the condition is completely pristine.',
      sentAt: '10:26 AM',
      mine: true,
      offer: { amount: 2100, status: 'countered' },
    },
    {
      id: 'm4',
      body: 'Meet in the middle? Makati works for me for the pickup.',
      sentAt: '10:30 AM',
      mine: false,
      offer: { amount: 2050, status: 'pending' },
    },
  ] satisfies PreviewMessage[],
} as const;

/** Public places suggested for a handoff, and the times offered when arranging one. */
export const previewMeetupSpots: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'greenbelt', label: 'Greenbelt 3, Makati' },
  { key: 'ayala-triangle', label: 'Ayala Triangle Gardens' },
  { key: 'megamall', label: 'SM Megamall' },
];

export const previewMeetupDays: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'saturday', label: 'Saturday' },
];

export const previewMeetupTimes: readonly { readonly key: string; readonly label: string }[] = [
  { key: '10am', label: '10:00 AM' },
  { key: '2pm', label: '2:00 PM' },
  { key: '6pm', label: '6:00 PM' },
];

export const previewReportReasons: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Something else' },
];

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
  {
    id: 'black-puffer-jacket',
    title: 'Black Quilted Puffer Jacket',
    estimate: 2700,
    status: 'private',
    capturedOn: 'Sep 21, 2026',
    photo: image.pufferBlack,
    photoLabel: 'Black quilted puffer jacket',
  },
  {
    id: 'sony-walkman-wm',
    title: 'Sony Walkman Cassette Player',
    estimate: 2100,
    status: 'on_feed',
    capturedOn: 'Sep 15, 2026',
    photo: image.walkman,
    photoLabel: 'Silver cassette Walkman player',
  },
  {
    id: 'keychron-k2',
    title: 'Keychron K2 Mechanical Keyboard',
    estimate: 3900,
    status: 'sold',
    capturedOn: 'Sep 02, 2026',
    photo: image.keyboard,
    photoLabel: 'Mechanical keyboard with RGB lighting on a desk',
  },
  {
    id: 'teal-half-zip',
    title: 'Nike Teal Half-Zip Windbreaker',
    estimate: 2350,
    status: 'listed',
    capturedOn: 'Aug 27, 2026',
    photo: image.windbreakerTeal,
    photoLabel: 'Teal Nike half-zip windbreaker on concrete',
  },
  {
    id: 'polaroid-onestep',
    title: 'Polaroid OneStep Camera',
    estimate: 2900,
    status: 'private',
    capturedOn: 'Aug 19, 2026',
    photo: image.polaroidScene,
    photoLabel: 'Polaroid camera on a shelf beside a plant',
  },
  {
    id: 'jordan-1-mid',
    title: 'Air Jordan 1 Mid',
    estimate: 5200,
    status: 'sold',
    capturedOn: 'Aug 03, 2026',
    photo: image.jordanBred,
    photoLabel: 'Red and black Air Jordan sneaker',
  },
  {
    id: 'polaroid-600-instant',
    title: 'Polaroid 600 Instant Camera',
    estimate: 3100,
    status: 'private',
    capturedOn: 'Jul 28, 2026',
    photo: image.polaroidCamera,
    photoLabel: 'Vintage Polaroid instant camera',
  },
  {
    id: 'colour-block-track-jacket',
    title: 'Nike Colour-Block Track Jacket',
    estimate: 2200,
    status: 'on_feed',
    capturedOn: 'Jul 20, 2026',
    photo: image.windbreakerRetro,
    photoLabel: 'Teal and purple colour-block track jacket',
  },
  {
    id: 'jordan-1-high-og',
    title: 'Air Jordan 1 High OG Bred',
    estimate: 8800,
    status: 'private',
    capturedOn: 'Jul 11, 2026',
    photo: image.jordanBred,
    photoLabel: 'Red and black Air Jordan sneaker',
  },
  {
    id: 'cassette-walkman',
    title: 'Vintage Cassette Walkman',
    estimate: 1700,
    status: 'sold',
    capturedOn: 'Jul 02, 2026',
    photo: image.walkman,
    photoLabel: 'Silver cassette Walkman player',
  },
];

/**
 * Where each of the viewer's items is shared. An item can sit on the feed, the market, both,
 * or neither (private, the default for a fresh capture).
 */
export interface PreviewSharing {
  readonly postId?: string;
  readonly listingId?: string;
  readonly sold?: boolean;
}

export const previewSharingByItem: Readonly<Record<string, PreviewSharing>> = {
  'nike-neon-windbreaker': { listingId: 'nike-neon-windbreaker' },
  'polaroid-sun-600': { postId: 'polaroid-sun-600' },
  'air-jordan-1-retro': { listingId: 'air-jordan-1-retro', sold: true },
  'sony-walkman-wm': { postId: 'retro-walkman-post' },
  'keychron-k2': { listingId: 'keychron-k2', sold: true },
  'teal-half-zip': { listingId: 'teal-half-zip' },
  'jordan-1-mid': { listingId: 'jordan-1-mid', sold: true },
  'colour-block-track-jacket': { postId: 'retro-windbreaker' },
  'cassette-walkman': { listingId: 'cassette-walkman', sold: true },
};

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
  /** Set once the conversation is over; it then lists under Past and can't be replied to. */
  readonly closed?: 'sold' | 'archived';
}

export const previewConversations: readonly PreviewConversationSummary[] = [
  {
    id: 'windbreaker-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Vintage Nike Neon Windbreaker',
    itemPhoto: image.windbreakerRetro,
    lastMessage: 'Offered ₱2,050 · Makati works for me for the pickup.',
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
    closed: 'sold',
  },
  {
    id: 'keyboard-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Mechanical Keychron Keyboard',
    itemPhoto: image.keyboard,
    lastMessage: 'No worries, maybe next time!',
    lastFromMe: false,
    sentAt: 'Sep 14',
    unread: 0,
    closed: 'archived',
  },
  {
    id: 'puffer-chat',
    with: previewUsers.justinV,
    itemTitle: 'Black Quilted Puffer Jacket',
    itemPhoto: image.pufferBlack,
    lastMessage: 'Is it a size M? I can meet at Glorietta on Saturday.',
    lastFromMe: false,
    sentAt: '9:12 AM',
    unread: 0,
  },
  {
    id: 'walkman-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Retro Walkman Player',
    itemPhoto: image.walkman,
    lastMessage: 'Does it still play both sides of the tape?',
    lastFromMe: true,
    sentAt: 'Yesterday',
    unread: 0,
  },
  {
    id: 'teal-windbreaker-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Retro Nike Teal Windbreaker',
    itemPhoto: image.windbreakerTeal,
    lastMessage: 'Would you take ₱2,300? I can pay through GCash.',
    lastFromMe: false,
    sentAt: 'Mon',
    unread: 0,
  },
  {
    id: 'film-bundle-chat',
    with: previewUsers.justinV,
    itemTitle: 'Polaroid Camera and Film Bundle',
    itemPhoto: image.polaroidScene,
    lastMessage: 'How many film packs are left in the bundle?',
    lastFromMe: true,
    sentAt: 'Sun',
    unread: 0,
  },
  {
    id: 'colour-block-chat',
    with: previewUsers.manilaHype,
    itemTitle: '90s Colour-Block Windbreaker',
    itemPhoto: image.windbreakerRetro,
    lastMessage: 'Sent you the measurements. Pit to pit is 24 inches.',
    lastFromMe: false,
    sentAt: 'Oct 2',
    unread: 0,
  },
  {
    id: 'polaroid-justin-chat',
    with: previewUsers.justinV,
    itemTitle: 'Vintage Polaroid Sun 600',
    itemPhoto: image.polaroidCamera,
    lastMessage: 'Does the flash still work? I mostly shoot indoors.',
    lastFromMe: false,
    sentAt: 'Sep 30',
    unread: 0,
  },
  {
    id: 'walkman-maria-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Retro Walkman Player',
    itemPhoto: image.walkman,
    lastMessage: 'I can bring spare batteries so you can test it.',
    lastFromMe: true,
    sentAt: 'Sep 26',
    unread: 0,
  },
  {
    id: 'keychron-hype-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Mechanical Keychron Keyboard',
    itemPhoto: image.keyboard,
    lastMessage: 'Which switches are on it, brown or red?',
    lastFromMe: false,
    sentAt: 'Sep 22',
    unread: 0,
  },
  {
    id: 'jordan-bred-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Air Jordan 1 High Bred',
    itemPhoto: image.jordanBred,
    lastMessage: 'Box and extra laces included. ₱8,500 is firm, sorry.',
    lastFromMe: true,
    sentAt: 'Sep 18',
    unread: 0,
  },
  {
    id: 'puffer-maria-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Black Quilted Puffer Jacket',
    itemPhoto: image.pufferBlack,
    lastMessage: 'Perfect for my trip to Baguio. Is it still available?',
    lastFromMe: false,
    sentAt: 'Sep 15',
    unread: 0,
  },
  {
    id: 'teal-justin-chat',
    with: previewUsers.justinV,
    itemTitle: 'Retro Nike Teal Windbreaker',
    itemPhoto: image.windbreakerTeal,
    lastMessage: 'Any stains or tears? Can you send a photo of the tag?',
    lastFromMe: false,
    sentAt: 'Sep 12',
    unread: 0,
  },
  {
    id: 'film-bundle-hype-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Polaroid Camera and Film Bundle',
    itemPhoto: image.polaroidScene,
    lastMessage: 'I can do ₱3,500 if you pick up this week.',
    lastFromMe: true,
    sentAt: 'Sep 9',
    unread: 0,
  },
  {
    id: 'colour-block-justin-chat',
    with: previewUsers.justinV,
    itemTitle: '90s Colour-Block Windbreaker',
    itemPhoto: image.windbreakerRetro,
    lastMessage: 'Would this fit someone who is 5 foot 9?',
    lastFromMe: false,
    sentAt: 'Sep 6',
    unread: 0,
  },
  {
    id: 'walkman-justin-chat',
    with: previewUsers.justinV,
    itemTitle: 'Retro Walkman Player',
    itemPhoto: image.walkman,
    lastMessage: 'Does it come with the original headphones?',
    lastFromMe: false,
    sentAt: 'Sep 3',
    unread: 0,
  },
  {
    id: 'polaroid-hype-chat',
    with: previewUsers.manilaHype,
    itemTitle: 'Vintage Polaroid Sun 600',
    itemPhoto: image.polaroidCamera,
    lastMessage: 'Let me know if the price drops. Still interested!',
    lastFromMe: false,
    sentAt: 'Aug 29',
    unread: 0,
  },
  {
    id: 'keychron-maria-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Mechanical Keychron Keyboard',
    itemPhoto: image.keyboard,
    lastMessage: 'I can meet at SM Megamall after work on Friday.',
    lastFromMe: true,
    sentAt: 'Aug 25',
    unread: 0,
  },
  {
    id: 'jordan-mid-chat',
    with: previewUsers.mariaCruz,
    itemTitle: 'Air Jordan 1 Mid',
    itemPhoto: image.jordanBred,
    lastMessage: 'Payment sent. Thanks for the quick meetup!',
    lastFromMe: false,
    sentAt: 'Aug 30',
    unread: 0,
    closed: 'sold',
  },
  {
    id: 'keychron-k2-chat',
    with: previewUsers.justinV,
    itemTitle: 'Keychron K2 Mechanical Keyboard',
    itemPhoto: image.keyboard,
    lastMessage: 'Got it, the keycaps are all there. Salamat!',
    lastFromMe: false,
    sentAt: 'Sep 5',
    unread: 0,
    closed: 'sold',
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

/** The story behind each "Hot this month" category, for its trend screen. */
export interface PreviewTrendDetail {
  /** One line in the app's voice, set big at the top. */
  readonly headline: string;
  readonly why: string;
  readonly typicalPrice: number;
  readonly low: number;
  readonly high: number;
  readonly soldThisMonth: number;
  /** Typical price over the last 12 weeks, oldest first. */
  readonly series: readonly number[];
  readonly listingIds: readonly string[];
  readonly postIds: readonly string[];
}

export const previewTrendDetails: Readonly<Record<string, PreviewTrendDetail>> = {
  'film-cameras': {
    headline: 'Film is back in frame.',
    why: 'Instant and point-and-shoot cameras keep climbing as film photos trend again. Working flashes and sealed film packs fetch the most.',
    typicalPrice: 3000,
    low: 2500,
    high: 3600,
    soldThisMonth: 42,
    series: [2400, 2450, 2500, 2480, 2600, 2650, 2700, 2750, 2820, 2880, 2950, 3000],
    listingIds: ['polaroid-sun-600'],
    postIds: ['polaroid-sun-600'],
  },
  sneakers: {
    headline: 'Grails hold their heat.',
    why: 'Classic colourways like the Jordan 1 Bred stay in demand. Original boxes and clean soles add the most value.',
    typicalPrice: 9200,
    low: 7800,
    high: 10500,
    soldThisMonth: 57,
    series: [8300, 8350, 8500, 8450, 8600, 8700, 8650, 8800, 8900, 9000, 9100, 9200],
    listingIds: ['air-jordan-1-bred'],
    postIds: [],
  },
  '90s-sportswear': {
    headline: 'The 90s never left.',
    why: 'Bold windbreakers and track jackets are back. Bright teal and purple colourways and original tags push prices up.',
    typicalPrice: 2450,
    low: 2100,
    high: 2850,
    soldThisMonth: 36,
    series: [2150, 2180, 2200, 2190, 2250, 2280, 2300, 2330, 2360, 2390, 2420, 2450],
    listingIds: ['nike-teal-windbreaker', 'colour-block-windbreaker'],
    postIds: ['retro-windbreaker'],
  },
  'retro-audio': {
    headline: 'Press play on the past.',
    why: 'Cassette players and Walkmans are steady sellers. Ones that still play, with the original belt clip, sell fastest.',
    typicalPrice: 1900,
    low: 1500,
    high: 2400,
    soldThisMonth: 18,
    series: [1780, 1800, 1790, 1820, 1830, 1850, 1840, 1860, 1870, 1880, 1890, 1900],
    listingIds: ['retro-walkman'],
    postIds: ['retro-walkman-post'],
  },
  keyboards: {
    headline: 'Cooling off, for now.',
    why: 'Mechanical keyboards dipped as new models launched. A good time to buy; if you are selling, include the original keycaps.',
    typicalPrice: 4300,
    low: 3600,
    high: 5000,
    soldThisMonth: 24,
    series: [4500, 4480, 4460, 4470, 4420, 4400, 4410, 4380, 4350, 4340, 4320, 4300],
    listingIds: ['keychron-keyboard'],
    postIds: ['keychron-post'],
  },
};

export const previewMarketCategories: readonly { readonly key: string; readonly label: string }[] =
  [
    { key: 'all', label: 'All' },
    { key: 'collectibles', label: 'Collectibles' },
    { key: 'fashion', label: 'Fashion' },
    { key: 'sneakers', label: 'Sneakers' },
    { key: 'electronics', label: 'Electronics' },
    { key: 'home', label: 'Home' },
  ];

/** Where each preview listing is, for the location filter, until listings carry a place. */
export const previewListingPlaces: Readonly<Record<string, { area: string; distanceKm: number }>> =
  {
    'polaroid-sun-600': { area: 'makati', distanceKm: 2 },
    'air-jordan-1-bred': { area: 'quezon-city', distanceKm: 11 },
    'retro-walkman': { area: 'pasig', distanceKm: 6 },
    'keychron-keyboard': { area: 'cebu', distanceKm: 570 },
    'nike-teal-windbreaker': { area: 'quezon-city', distanceKm: 9 },
    'colour-block-windbreaker': { area: 'pasig', distanceKm: 5 },
    'black-puffer-jacket': { area: 'makati', distanceKm: 3 },
    'polaroid-film-bundle': { area: 'makati', distanceKm: 4 },
  };

export const previewMarketAreas: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'anywhere', label: 'Anywhere' },
  { key: 'near-me', label: 'Near me' },
  { key: 'makati', label: 'Makati' },
  { key: 'quezon-city', label: 'Quezon City' },
  { key: 'pasig', label: 'Pasig' },
  { key: 'cebu', label: 'Cebu' },
];

export const previewPriceBrackets: readonly {
  readonly key: string;
  readonly label: string;
  readonly min: number | null;
  readonly max: number | null;
}[] = [
  { key: 'under-2k', label: 'Under ₱2,000', min: null, max: 2000 },
  { key: '2k-5k', label: '₱2,000–₱5,000', min: 2000, max: 5000 },
  { key: 'over-5k', label: '₱5,000+', min: 5000, max: null },
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

/** The viewer's own listing, so the listing screen can show what a seller sees. */
export const previewMyListing = {
  id: 'nike-neon-windbreaker',
  title: 'Vintage Nike Neon Windbreaker',
  category: 'Fashion',
  askingPrice: 2800,
  photo: image.windbreakerRetro,
  photoLabel: 'Teal and purple vintage Nike windbreaker',
  justRightShare: 71,
  seller: { ...previewUsers.retroCurator, rating: '4.8', sales: 12 },
  description:
    'Early 90s Nike windbreaker in teal and purple. No tears, zip runs smoothly, light fading on the cuffs. Size L, fits true.',
  stats: { views: 214, saves: 18, chats: 3 },
} as const;

export const previewMyListingInsight = {
  listingId: 'nike-neon-windbreaker',
  estimateLow: 2100,
  estimateHigh: 2800,
  estimate: 2450,
  confidence: 'high' as PreviewConfidence,
  offerSuggestions: [2450, 2600, 2700],
  watchers: 9,
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
