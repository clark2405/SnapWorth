import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import {
  BackdropHostContext,
  requestScrollToTop,
  SharedBackdrop,
  TabBar,
  WithSkeleton,
} from '@snapworth/shared/components';
import { useTheme, useWideLayout } from '@snapworth/shared/design';
import { useAccountGate } from '@snapworth/shared/features/session';

import { tabRoutes, tabs, type TabKey } from '../../../src/places';

/**
 * The four places, kept alive side by side: switching shows a tab that's already built, with
 * its scroll position and state, instead of building it again. On a phone-sized window they
 * share the floating tab bar, laid out like iOS's, with Snap above it and Search beside it;
 * wider, the sidebar beside the whole app takes its place.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const wide = useWideLayout();
  const router = useRouter();
  const requireAccount = useAccountGate();

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

  // One backdrop for all four tabs, drawn once behind them: switching tabs changes it in place,
  // so a quick run of switches is one continuous change rather than a jump between drawings.
  return (
    <BackdropHostContext.Provider value>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SharedBackdrop />
        <Tabs
          // Anything not loaded yet shows its shape, in its colour, rather than an empty page.
          screenLayout={({ route, children }) => (
            <View style={{ flex: 1 }}>
              <WithSkeleton kind="tab" place={tabs.find((tab) => tab.key === route.name)?.place}>
                {children}
              </WithSkeleton>
            </View>
          )}
          screenOptions={{
            headerShown: false,
            // The backdrop's morph carries the change of place; a second animation would fight it.
            animation: 'none',
            // Clear, so the one backdrop behind all four shows through (see below).
            sceneStyle: { backgroundColor: 'transparent' },
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
                onSnap={() => requireAccount('snap', () => router.push('/capture'))}
                onSearch={() => router.push('/search')}
              />
            );
          }}
        >
          <Tabs.Screen name="feed" />
          <Tabs.Screen name="marketplace" />
          <Tabs.Screen name="chat" />
          <Tabs.Screen name="history" />
        </Tabs>
      </View>
    </BackdropHostContext.Provider>
  );
}
