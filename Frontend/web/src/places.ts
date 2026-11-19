import type { Href } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';

import { FeedIcon, MarketIcon, type SideNavItem, type TabItem } from '@snapworth/shared/components';

/**
 * The website is the moderators' console. Beside the console itself (the sidebar's Moderation
 * button), moderators can look through the Feed and the Market to see posts and listings in place.
 * Chats, History, Snap and Worthy are the phone app's, so the website has no way to them.
 */
export type TabKey = 'admin' | 'feed' | 'marketplace';

export const tabRoutes: Record<TabKey, Href> = {
  admin: '/admin',
  feed: '/feed',
  marketplace: '/marketplace',
};

/** The sidebar's places; the console has its own button there, with how many cases wait. */
export const tabs = [
  { key: 'feed', label: 'Feed', icon: FeedIcon, place: 'feed' },
  { key: 'marketplace', label: 'Market', icon: MarketIcon, place: 'market' },
] as const satisfies readonly SideNavItem<TabKey>[];

/** A phone-sized window has no sidebar, so the console is a tab of its own. */
export const compactTabs = [
  { key: 'admin', label: 'Console', icon: ShieldCheck },
  { key: 'feed', label: 'Feed', icon: FeedIcon },
  { key: 'marketplace', label: 'Market', icon: MarketIcon },
] as const satisfies readonly TabItem<TabKey>[];

/** Which place a screen belongs to: its own tab, or the tab it is opened from. */
export function placeForPath(pathname: string): TabKey | undefined {
  const [first] = pathname.split('/').filter(Boolean);
  switch (first) {
    case 'admin':
      return 'admin';
    case 'feed':
    case 'post':
      return 'feed';
    case 'marketplace':
    case 'listing':
    case 'seller':
    case 'hanap':
      return 'marketplace';
    default:
      return undefined;
  }
}

/**
 * The screens a moderator uses on the website. Anything else (a link to Snap, a chat, History, a
 * game) goes to the console instead.
 */
export function isModeratorPath(pathname: string): boolean {
  const [first] = pathname.split('/').filter(Boolean);
  if (!first) return true;
  if (first === 'settings') return /^\/settings\/(profile|help)\/?$/.test(pathname);
  return [
    'admin',
    'feed',
    'marketplace',
    'post',
    'listing',
    'seller',
    'hanap',
    'search',
    'profile',
  ].includes(first);
}
