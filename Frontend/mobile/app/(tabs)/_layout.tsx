import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { fontFaces, useTheme } from '@snapworth/shared/design';

/**
 * The system tab bar: on iOS 26 it is Liquid Glass, floats over content, and minimises as you
 * scroll. Symbols fill when selected, the way first-party apps do. Snap sits in the middle as
 * the core action and opens the camera in place.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      tintColor={colors.textPrimary}
      minimizeBehavior="onScrollDown"
      labelStyle={{ fontSize: 10, fontFamily: fontFaces['500'] }}
    >
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
      <NativeTabs.Trigger name="capture">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'camera.viewfinder', selected: 'camera.viewfinder' }}
          md="photo_camera"
        />
        <NativeTabs.Trigger.Label>Snap</NativeTabs.Trigger.Label>
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
        <NativeTabs.Trigger.Badge>2</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }}
          md="history"
        />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
