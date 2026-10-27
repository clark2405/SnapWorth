import { Stack, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

import { requestScrollToTop, SideNav } from '@snapworth/shared/components';
import { useLayoutClass, useTheme } from '@snapworth/shared/design';
import { useAccountGate } from '@snapworth/shared/features/session';

import { placeForPath, tabRoutes, tabs } from '../../src/places';

/**
 * The app behind the launch and sign-in screens. Screens opened from a tab stack over the tabs,
 * so going back returns to the tab as it was. On a wide window a sidebar runs down the left of
 * every screen, a rail of icons at tablet widths and labelled on a desktop.
 */
export default function ProductLayout() {
  const { colors } = useTheme();
  const layout = useLayoutClass();
  const pathname = usePathname();
  const router = useRouter();
  const requireAccount = useAccountGate();

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'fade',
      }}
    />
  );
  if (layout === 'compact') return stack;

  const activeKey = placeForPath(pathname);
  const onTab = activeKey !== undefined && tabRoutes[activeKey] === pathname;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.canvas }}>
      <SideNav
        items={tabs}
        rail={layout === 'medium'}
        activeKey={activeKey}
        // The place you're already on goes back to its top; anywhere else goes to that place.
        onSelect={(key) =>
          key === activeKey && onTab ? requestScrollToTop() : router.navigate(tabRoutes[key])
        }
        onSnap={() => requireAccount('snap', () => router.push('/capture'))}
        onSearch={() => router.push('/search')}
        onOpenProfile={() => router.push('/profile')}
      />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
