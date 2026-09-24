import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Clock, MessageSquare, Newspaper, ShoppingBag } from 'lucide-react-native';
import { View } from 'react-native';

import { TabBar, type TabItem } from '@snapworth/shared/components';

type TabKey = 'feed' | 'marketplace' | 'chat' | 'history';

const tabRoutes: Record<TabKey, Href> = {
  feed: '/feed',
  marketplace: '/marketplace',
  chat: '/chat',
  history: '/history',
};

const leading = [
  { key: 'feed', label: 'Feed', icon: Newspaper },
  { key: 'marketplace', label: 'Market', icon: ShoppingBag },
] as const satisfies readonly TabItem<TabKey>[];

const trailing = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'history', label: 'History', icon: Clock },
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
          leading={leading}
          trailing={trailing}
          activeKey={activeKey}
          onSelect={(key) => router.replace(tabRoutes[key])}
          onCapture={() => router.push('/capture')}
        />
      ) : null}
    </View>
  );
}
