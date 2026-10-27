import type { Href } from 'expo-router';

import {
  ChatsIcon,
  FeedIcon,
  HistoryIcon,
  MarketIcon,
  type SideNavItem,
} from '@snapworth/shared/components';

export type TabKey = 'feed' | 'marketplace' | 'chat' | 'history';

export const tabRoutes: Record<TabKey, Href> = {
  feed: '/feed',
  marketplace: '/marketplace',
  chat: '/chat',
  history: '/history',
};

// Places only: Snap is an action, so it lives in the Feed and History headers (and as Sell in
// Market), and leads the sidebar on wide screens, not in the bar.
export const tabs = [
  { key: 'feed', label: 'Feed', icon: FeedIcon, place: 'feed' },
  { key: 'marketplace', label: 'Market', icon: MarketIcon, place: 'market' },
  { key: 'chat', label: 'Chats', icon: ChatsIcon, place: 'chat' },
  { key: 'history', label: 'History', icon: HistoryIcon, place: 'history' },
] as const satisfies readonly SideNavItem<TabKey>[];

/** Which place a screen belongs to: its own tab, or the tab it is opened from. */
export function placeForPath(pathname: string): TabKey | undefined {
  const [first] = pathname.split('/').filter(Boolean);
  switch (first) {
    case 'feed':
    case 'post':
    case 'trend':
      return 'feed';
    case 'marketplace':
    case 'listing':
    case 'seller':
      return 'marketplace';
    case 'chat':
      return 'chat';
    case 'history':
    case 'item':
    case 'list':
      return 'history';
    default:
      return undefined;
  }
}
