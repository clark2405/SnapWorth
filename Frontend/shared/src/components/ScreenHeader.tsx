import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';
import { IconButton } from './IconButton';
import { useRegisterLargeTitle, useScreenScroll } from './Screen';
import { SWText } from './SWText';

export interface NavHeaderProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly trailing?: ReactNode;
  /**
   * `true` keeps the title visible from the start (flows like Sell or Confirm price);
   * otherwise the title fades in once the content starts to scroll under the bar.
   */
  readonly banded?: boolean;
}

/**
 * Floating navigation for detail and flow screens: the controls sit in glass circles over the
 * content, and a glass bar with the title materialises only once the page has scrolled beneath
 * it. At rest the content (usually the item photo) runs to the top edge.
 */
export function NavHeader({ title, onBack, trailing, banded = false }: NavHeaderProps) {
  const scroll = useScreenScroll();
  const styles = useThemedStyles(stylesFor);

  const barStyle = useAnimatedStyle(() => {
    const y = scroll?.scrollY.value ?? 0;
    return { opacity: interpolate(y, [0, 36], [banded ? 1 : 0, 1], Extrapolation.CLAMP) };
  });
  const titleStyle = useAnimatedStyle(() => {
    const y = scroll?.scrollY.value ?? 0;
    const start = banded ? 0 : 60;
    return {
      opacity: banded ? 1 : interpolate(y, [start, start + 40], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: banded ? 0 : interpolate(y, [start, start + 40], [8, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.barLayer, barStyle]}>
        <GlassSurface style={styles.bar} />
      </Animated.View>
      <View style={styles.nav}>
        <View style={styles.side}>
          {onBack ? (
            <IconButton icon={ChevronLeft} label="Go back" appearance="glass" onPress={onBack} />
          ) : null}
        </View>
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <SWText
            variant="headingMedium"
            accessibilityRole="header"
            numberOfLines={1}
            align="center"
          >
            {title}
          </SWText>
        </Animated.View>
        <View style={[styles.side, styles.trailing]}>{trailing}</View>
      </View>
    </View>
  );
}

export interface LargeTitleProps {
  readonly title: string;
  /** A short line under the title that states what the screen is for. */
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
}

/**
 * The editorial title that opens a top-level tab, set in the serif. As the page scrolls it
 * drifts up a little slower than the content and fades, handing off to the compact glass bar.
 */
export function LargeTitle({ title, subtitle, trailing }: LargeTitleProps) {
  const scroll = useScreenScroll();
  const register = useRegisterLargeTitle(title);
  const styles = useThemedStyles(stylesFor);

  const textStyle = useAnimatedStyle(() => {
    const y = scroll?.scrollY.value ?? 0;
    const edge = scroll?.titleEdge.value ?? 80;
    return {
      opacity: interpolate(y, [0, edge * 0.8], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(y, [-100, 0, edge], [18, 0, edge * 0.3]) }],
    };
  });

  return (
    <View
      style={styles.large}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        register(y + height - tokens.spacing[6]);
      }}
    >
      <Animated.View style={[styles.largeText, textStyle]}>
        <SWText variant="displayTitle" accessibilityRole="header">
          {title}
        </SWText>
        {subtitle ? (
          <SWText variant="bodySmall" tone="textMuted">
            {subtitle}
          </SWText>
        ) : null}
      </Animated.View>
      {trailing}
    </View>
  );
}

const stylesFor = themedStyles(() => ({
  wrap: {
    position: 'relative',
  },
  barLayer: {
    pointerEvents: 'none',
  },
  bar: {
    flex: 1,
    borderWidth: 0,
  },
  nav: {
    minHeight: tokens.layout.headerCompact,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[3],
  },
  side: {
    minWidth: tokens.focus.minimumTarget + tokens.spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  trailing: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: tokens.spacing[2],
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[6],
  },
  largeText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
}));
