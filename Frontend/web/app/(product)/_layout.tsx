import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import {
  ChatsIcon,
  FeedIcon,
  HistoryIcon,
  MarketIcon,
  requestScrollToTop,
  TabBar,
  type TabItem,
} from '@snapworth/shared/components';

type TabKey = 'feed' | 'marketplace' | 'chat' | 'history';

const tabRoutes: Record<TabKey, Href> = {
  feed: '/feed',
  marketplace: '/marketplace',
  chat: '/chat',
  history: '/history',
};

// Places only: Snap is an action, so it lives in the Feed and History headers (and as Sell in
// Market), not in the bar.
const tabs = [
  { key: 'feed', label: 'Feed', icon: FeedIcon },
  { key: 'marketplace', label: 'Market', icon: MarketIcon },
  { key: 'chat', label: 'Chats', icon: ChatsIcon },
  { key: 'history', label: 'History', icon: HistoryIcon },
] as const satisfies readonly TabItem<TabKey>[];

export default function ProductLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = (Object.keys(tabRoutes) as TabKey[]).find((key) => tabRoutes[key] === pathname);

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {activeKey ? (
        <TabBar
          tabs={tabs}
          activeKey={activeKey}
          // Tapping the tab you are on takes its page back to the top.
          onSelect={(key) =>
            key === activeKey ? requestScrollToTop() : router.replace(tabRoutes[key])
          }
        />
      ) : null}
    </View>
  );
}
