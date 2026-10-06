import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, View } from 'react-native';

import { fontFaces, useTheme } from '@snapworth/shared/design';
import { useSession } from '@snapworth/shared/features/session';

import { SnapAccessory, SnapBar } from '../../src/SnapAccessory';

/**
 * The system tab bar: on iOS 26 it is Liquid Glass, floats over content, and minimises as you
 * scroll. Symbols fill when selected, the way first-party apps do. Tabs are places only; Snap, the
 * core action, rides above them as the bottom accessory on every tab and opens the camera full
 * screen.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { isGuest } = useSession();

  const tabs = (
    <NativeTabs
      // The brand's one accent marks where you are, as Apple suggests for the tint colour.
      tintColor={colors.accent}
      minimizeBehavior="onScrollDown"
      labelStyle={{ fontSize: 10, fontFamily: fontFaces['500'] }}
    >
      {Platform.OS === 'ios' ? (
        <NativeTabs.BottomAccessory>
          <SnapAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sparkles.rectangle.stack', selected: 'sparkles.rectangle.stack.fill' }}
          md="dynamic_feed"
        />
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="marketplace">
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="shopping_bag" />
        <NativeTabs.Trigger.Label>Market</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        {/* A guest has no conversations, so nothing is unread. */}
        {isGuest ? null : <NativeTabs.Trigger.Badge>2</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }}
          md="history"
        />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* One place to search everything; iOS sets the search role apart at the trailing end. */}
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );

  if (Platform.OS !== 'android') return tabs;
  // Android has no tab bar accessory: the same Snap bar floats above Material's navigation bar.
  return (
    <View style={{ flex: 1 }}>
      {tabs}
      <SnapBar />
    </View>
  );
}
