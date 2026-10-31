import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contentScrolling, SnapRow } from '@snapworth/shared/components';
import { tokens, useTheme } from '@snapworth/shared/design';
import { useAccountGate } from '@snapworth/shared/features/session';

function useOpenCamera() {
  const router = useRouter();
  const requireAccount = useAccountGate();
  return () => requireAccount('snap', () => router.push('/capture'));
}

/**
 * Snap, the app's core action, as the tab bar's bottom accessory: the Liquid Glass bar iOS 26
 * keeps above the tabs on every screen (the way Music keeps what's playing). It is always one
 * reach away and visibly the main thing to do, without pretending to be a tab. Scrolling
 * folds it into the tab bar, where it shows just the camera and its name.
 */
export function SnapAccessory() {
  const open = useOpenCamera();
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  return <SnapRow compact={inline} onPress={open} />;
}

/**
 * Android's counterpart: Android has no tab bar accessory, so the same bar floats on its own
 * above the Material navigation bar, in the same place and wording as on iPhone. While the
 * page scrolls it narrows to a compact pill, as the iOS bar folds into its tab bar.
 */
export function SnapBar() {
  const open = useOpenCamera();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const folded = contentScrolling.value > 0.5;
    return {
      transform: [{ scale: withTiming(folded ? 0.94 : 1, { duration: 180 }) }],
      opacity: withTiming(folded ? 0.92 : 1, { duration: 180 }),
    };
  });
  return (
    <Animated.View
      style={[
        styles.floating,
        {
          bottom: insets.bottom + androidNavigationBarHeight + tokens.spacing[2],
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
        },
        style,
      ]}
    >
      <SnapRow compact={false} onPress={open} />
    </Animated.View>
  );
}

/** Material 3's navigation bar, which the Android bar sits just above. */
const androidNavigationBarHeight = 80;

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: tokens.spacing[4],
    right: tokens.spacing[4],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
  },
});
