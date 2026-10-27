import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { requestScrollToTop, ScreenSkeleton, TabBar } from '@snapworth/shared/components';
import { useTheme, useWideLayout } from '@snapworth/shared/design';

import { tabRoutes, tabs, type TabKey } from '../../../src/places';

/**
 * The four places, kept alive side by side: switching shows a tab that's already built, with
 * its scroll position and state, instead of building it again. On a phone-sized window they
 * share the floating tab bar; wider, the sidebar beside the whole app takes its place.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const wide = useWideLayout();
  const router = useRouter();

  // Each screen's code arrives the first time it's opened. Once the app has settled, the other
  // tabs are fetched and built in the background, so opening one never waits on the network.
  useEffect(() => {
    const preload = () =>
      (Object.keys(tabRoutes) as TabKey[]).forEach((key) => router.prefetch(tabRoutes[key]));
    const idle = globalThis.requestIdleCallback;
    if (idle) {
      const handle = idle(preload, { timeout: 2500 });
      return () => globalThis.cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(preload, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Tabs
      // Anything not loaded yet shows its shape, in its colour, rather than an empty page.
      screenLayout={({ route, children }) => (
        <View style={{ flex: 1 }}>
          <ScreenSkeleton kind="tab" place={tabs.find((tab) => tab.key === route.name)?.place} />
          {children}
        </View>
      )}
      screenOptions={{
        headerShown: false,
        // The backdrop's morph carries the change of place; a second animation would fight it.
        animation: 'none',
        sceneStyle: { backgroundColor: colors.canvas },
      }}
      tabBar={({ state, navigateToTab }) => {
        if (wide) return null;
        const active = state.routes[state.index];
        const activeKey = active?.name as TabKey | undefined;
        return (
          <TabBar
            tabs={tabs}
            activeKey={activeKey}
            // Tapping the tab you are on takes its page back to the top.
            onSelect={(key) => {
              if (key === activeKey) return requestScrollToTop();
              const route = state.routes.find((entry) => entry.name === key);
              if (route) navigateToTab(route.key);
            }}
          />
        );
      }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="marketplace" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}
