import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

import { requestScrollToTop, SideNav, WithSkeleton } from '@snapworth/shared/components';
import { useLayoutClass, useTheme } from '@snapworth/shared/design';
import { useReviewCount } from '@snapworth/shared/features/admin';
import { useAdminStatus } from '@snapworth/shared/features/profile';
import { useSession } from '@snapworth/shared/features/session';

import { ModeratorGate } from '../../src/ModeratorGate';
import { isModeratorPath, placeForPath, tabRoutes, tabs } from '../../src/places';

/** Screens that open on a photo with their details beside or beneath it. */
const detailRoutes = new Set(['listing/[id]', 'post/[id]', 'item/[id]', 'trend/[key]', 'ask/[id]']);

/**
 * The moderators' console, behind the sign-in screens. Only a moderator gets in: a guest is sent
 * to sign in, anyone else is told the website is for moderators, and a screen that isn't for
 * moderating (Snap, chats, History…) leads to the console. The database checks the role again on
 * every moderation call, so this decides what the website shows, never what anyone may do.
 * Screens opened from a tab stack over the tabs, so going back returns to the tab as it was. On a
 * wide window a sidebar runs down the left of every screen, a rail of icons at tablet widths and
 * labelled on a desktop.
 */
export default function ProductLayout() {
  const { colors } = useTheme();
  const layout = useLayoutClass();
  const pathname = usePathname();
  const router = useRouter();
  const { endSession } = useSession();
  const admin = useAdminStatus();
  const isAdmin = admin.status === 'admin';
  const reviewCount = useReviewCount(isAdmin);

  const stack = (
    <Stack
      // A screen opened for the first time shows its shape while its code arrives. The tabs bring
      // their own (a band and a list).
      screenLayout={({ route, children }) => (
        <View style={{ flex: 1 }}>
          {route.name === '(tabs)' ? (
            children
          ) : (
            <WithSkeleton kind={detailRoutes.has(route.name) ? 'detail' : 'page'}>
              {children}
            </WithSkeleton>
          )}
        </View>
      )}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'fade',
      }}
    />
  );
  if (admin.status === 'checking') {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }
  if (admin.status === 'guest') return <Redirect href="/login" />;
  if (admin.status === 'not-admin' || admin.status === 'failed') {
    return (
      <ModeratorGate
        reason={admin.status}
        onRetry={admin.retry}
        onSignOut={() => {
          endSession();
          router.replace('/login');
        }}
      />
    );
  }
  if (!isModeratorPath(pathname)) return <Redirect href="/admin" />;

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
        onSearch={() => router.push('/search')}
        onOpenProfile={() => router.push('/profile')}
        // The console leads the sidebar, with how many cases wait.
        onModerate={() => router.push('/admin')}
        moderationCount={reviewCount}
      />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
