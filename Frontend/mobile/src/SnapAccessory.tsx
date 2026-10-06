import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Camera, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, SWText, contentScrolling } from '@snapworth/shared/components';
import { tokens, useTheme } from '@snapworth/shared/design';
import { useAccountGate } from '@snapworth/shared/features/session';

function useOpenCamera() {
  const router = useRouter();
  const requireAccount = useAccountGate();
  return () => requireAccount('snap', () => router.push('/capture'));
}

/** The Snap control's face, shared by iOS and Android so both read the same. */
function SnapRow({
  compact,
  onPress,
}: {
  readonly compact: boolean;
  readonly onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Snap it"
      accessibilityHint="Opens the camera to photograph something and find out what it's worth"
      haptic="pop"
      onPress={onPress}
      style={[styles.row, compact ? styles.rowCompact : null]}
    >
      <View
        style={[
          styles.lens,
          compact ? styles.lensCompact : null,
          { backgroundColor: colors.accent },
        ]}
      >
        <Camera size={compact ? 15 : 18} strokeWidth={2.2} color={colors.onAccent} />
      </View>
      {compact ? (
        <SWText variant="label">Snap it</SWText>
      ) : (
        <>
          <View style={styles.text}>
            <SWText variant="label">Snap it</SWText>
            <SWText variant="caption" tone="textSecondary" numberOfLines={1}>
              Find out what it&apos;s worth
            </SWText>
          </View>
          <ChevronRight size={18} strokeWidth={2.2} color={colors.textMuted} />
        </>
      )}
    </PressableScale>
  );
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

// The accessory's content view is laid out with no height of its own (react-native-screens
// 4.26), so the row sets the accessory's height itself rather than stretching to fill it.
const regularHeight = 48;
const compactHeight = 40;
/** Material 3's navigation bar, which the Android bar sits just above. */
const androidNavigationBarHeight = 80;

const styles = StyleSheet.create({
  row: {
    height: regularHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[4],
  },
  rowCompact: {
    height: compactHeight,
    gap: tokens.spacing[2],
    paddingRight: tokens.spacing[3],
  },
  lens: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensCompact: {
    width: 28,
    height: 28,
  },
  text: {
    flex: 1,
  },
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
