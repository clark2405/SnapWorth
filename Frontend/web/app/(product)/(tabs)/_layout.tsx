import { Tabs } from 'expo-router';

import { requestScrollToTop, TabBar } from '@snapworth/shared/components';
import { useTheme, useWideLayout } from '@snapworth/shared/design';

import { tabs, type TabKey } from '../../../src/places';

/**
 * The four places, kept alive side by side: switching shows a tab that's already built, with
 * its scroll position and state, instead of building it again. On a phone-sized window they
 * share the floating tab bar; wider, the sidebar beside the whole app takes its place.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const wide = useWideLayout();

  return (
    <Tabs
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
