import {
  Bell,
  Camera,
  ChartLine,
  HandCoins,
  MessageSquareText,
  PencilLine,
  Scale,
  ScanSearch,
  Share2,
  Sparkles,
  Tag,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';

import type { CompanionAction } from '../../components';
import { formatPeso, previewListingDetail, previewPortfolio } from '../preview/sample-data';

export interface CompanionConfig {
  readonly hidden: boolean;
  /** Where Worthy rests: above the tab bar on tab roots, above the action bar on details. */
  readonly lift: 'tabBar' | 'actionBar';
  readonly greeting: string;
  readonly hint?: string;
  readonly actions: readonly CompanionAction[];
}

export interface CompanionHost {
  readonly go: (href: string) => void;
  readonly ask: (question: string) => void;
  readonly notify: (title: string, body?: string) => void;
}

/** Screens where a floating companion would cover the task (typing, framing a photo). */
const hiddenOn = [
  /^\/$/,
  /^\/onboarding/,
  /^\/(login|signup|reset-password)/,
  /^\/capture/,
  /^\/chat\/./,
  /^\/worthy/,
  /^\/search/,
  /^\/ask\//,
  /^\/list\//,
];

/**
 * What Worthy offers depends on where you are: on a listing it judges the price, on your item it
 * writes the listing, in History it tallies your collection. Hrefs are shared by web and mobile.
 */
export function companionConfigFor(pathname: string, host: CompanionHost): CompanionConfig {
  const { go, ask, notify } = host;
  const hidden = hiddenOn.some((pattern) => pattern.test(pathname));
  const lift = /^\/(item|listing|post|seller)\//.test(pathname) ? 'actionBar' : 'tabBar';
  const snap: CompanionAction = {
    key: 'snap',
    label: 'Snap something to value',
    detail: 'Point, shoot, get a price in seconds',
    icon: Camera,
    onPress: () => go('/capture'),
  };

  if (pathname.startsWith('/listing/')) {
    return {
      hidden,
      lift,
      greeting: `This one's asking ${formatPeso(previewListingDetail.askingPrice)}. Want my honest read on the price?`,
      hint: 'Is this a fair price? Ask me',
      actions: [
        {
          key: 'fair',
          label: 'Is this a fair price?',
          detail: 'Compared with 14 recent sales',
          icon: Scale,
          onPress: () => ask('Is this a fair price?'),
        },
        {
          key: 'offer',
          label: 'Suggest an offer',
          detail: 'An amount the seller is likely to accept',
          icon: HandCoins,
          onPress: () => ask('What should I offer?'),
        },
        {
          key: 'watch',
          label: 'Alert me if it drops',
          detail: 'Get notified on any price change',
          icon: Bell,
          onPress: () => notify('Price alert set', "I'll tell you if this drops below ₱3,000."),
        },
        snap,
      ],
    };
  }

  if (pathname.startsWith('/item/')) {
    return {
      hidden,
      lift,
      greeting: 'Nice find. I can turn this into a listing, or help you tighten the estimate.',
      hint: 'I can write the listing for you',
      actions: [
        {
          key: 'write',
          label: 'Write my listing',
          detail: 'Title, description, and price',
          icon: PencilLine,
          onPress: () => ask('Write my listing'),
        },
        {
          key: 'improve',
          label: 'Tighten the estimate',
          detail: 'Add a photo of the tag or any wear',
          icon: ScanSearch,
          onPress: () => go('/capture'),
        },
        {
          key: 'trend',
          label: 'Where is the price heading?',
          detail: '12 weeks of sales',
          icon: ChartLine,
          onPress: () => ask('Where is the price heading?'),
        },
        {
          key: 'share',
          label: 'Share a valuation card',
          detail: 'Send the estimate to a friend',
          icon: Share2,
          onPress: () => notify('Valuation card ready', 'Saved to your photos.'),
        },
      ],
    };
  }

  if (pathname.startsWith('/history') || pathname.startsWith('/profile')) {
    return {
      hidden,
      lift,
      greeting: `Your collection is worth about ${formatPeso(previewPortfolio.total)} right now — ${previewPortfolio.changeLabel}.`,
      actions: [
        {
          key: 'worth',
          label: 'What is my collection worth?',
          detail: 'Totals, trend, and top movers',
          icon: Wallet,
          onPress: () => ask('What is my collection worth?'),
        },
        {
          key: 'sell',
          label: 'What should I sell next?',
          detail: 'Items near their peak',
          icon: TrendingUp,
          onPress: () => ask('What should I sell next?'),
        },
        snap,
      ],
    };
  }

  if (pathname.startsWith('/marketplace')) {
    return {
      hidden,
      lift,
      greeting: 'Hunting for something? I can spot deals priced under what they are worth.',
      actions: [
        {
          key: 'deals',
          label: 'Find underpriced deals',
          detail: 'Listings below their AI estimate',
          icon: Tag,
          onPress: () => go('/search?scope=market'),
        },
        {
          key: 'sell',
          label: 'Sell something',
          detail: 'Snap it and I will price it',
          icon: Camera,
          onPress: () => go('/capture'),
        },
        {
          key: 'trend',
          label: "What's trending?",
          detail: 'Categories rising this month',
          icon: TrendingUp,
          onPress: () => ask("What's trending?"),
        },
      ],
    };
  }

  if (pathname.startsWith('/chat')) {
    return {
      hidden,
      lift,
      greeting: 'Negotiating? I can help you land on a fair number.',
      actions: [
        {
          key: 'reply',
          label: 'Draft a reply',
          detail: 'Friendly, firm, and fair',
          icon: MessageSquareText,
          onPress: () => ask('Draft a reply to my buyer'),
        },
        {
          key: 'fair',
          label: 'Is their offer fair?',
          detail: 'Checked against recent sales',
          icon: Scale,
          onPress: () => ask('Is their offer fair?'),
        },
        snap,
      ],
    };
  }

  return {
    hidden,
    lift,
    greeting: "Hi, I'm Worthy. Snap anything and I'll tell you what it's worth.",
    hint: pathname.startsWith('/feed') ? 'Hold me to open the camera' : undefined,
    actions: [
      snap,
      {
        key: 'trend',
        label: "What's trending?",
        detail: 'Categories rising this month',
        icon: TrendingUp,
        onPress: () => ask("What's trending?"),
      },
      {
        key: 'ask',
        label: 'Ask the community',
        detail: 'Post an item for price votes',
        icon: Sparkles,
        onPress: () => go('/capture'),
      },
    ],
  };
}
