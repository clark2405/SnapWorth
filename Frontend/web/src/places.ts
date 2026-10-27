import type { Href } from 'expo-router';

import {
  ChatsIcon,
  FeedIcon,
  HistoryIcon,
  MarketIcon,
  type TabItem,
} from '@snapworth/shared/components';

export type TabKey = 'feed' | 'marketplace' | 'chat' | 'history';

export const tabRoutes: Record<TabKey, Href> = {
  feed: '/feed',
  marketplace: '/marketplace',
  chat: '/chat',
  history: '/history',
};

// Places only: Snap is an action, so it lives in the Feed and History headers (and as Sell in
// Market), not in the bar.
export const tabs = [
  { key: 'feed', label: 'Feed', icon: FeedIcon },
  { key: 'marketplace', label: 'Market', icon: MarketIcon },
  { key: 'chat', label: 'Chats', icon: ChatsIcon },
  { key: 'history', label: 'History', icon: HistoryIcon },
] as const satisfies readonly TabItem<TabKey>[];
