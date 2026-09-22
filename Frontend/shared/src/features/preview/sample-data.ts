/**
 * Preview content for the Liquid Glass screens, taken from the Figma exports in
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
