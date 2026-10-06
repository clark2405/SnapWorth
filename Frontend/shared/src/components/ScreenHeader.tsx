import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { Wordmark } from './Brand';
import { IconButton } from './IconButton';
import { Overline } from './Overline';
import { useRegisterLargeTitle, useScreenScroll } from './Screen';
import { ScrollEdge } from './ScrollEdge';
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
 * content, and a soft scroll edge with the title materialises only once the page has scrolled
 * beneath it. At rest the content (usually the item photo) runs to the top edge.
 */
export function NavHeader({ title, onBack, trailing, banded = false }: NavHeaderProps) {
  const scroll = useScreenScroll();
  const insets = useSafeAreaInsets();
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
      <Animated.View style={[styles.barLayer, { top: -insets.top }, barStyle]}>
        <ScrollEdge solid={insets.top + tokens.layout.headerCompact} />
      </Animated.View>
      {/* In a sheet there is no status bar above the header, so it brings its own top margin
          rather than sitting on the sheet's rounded edge. */}
      <View style={[styles.nav, insets.top < sheetTopInset ? styles.navInSheet : null]}>
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
  /** The small uppercase line above the title, e.g. "Community · Is the AI right?". */
  readonly overline?: string;
  /** A thin line icon that leads the overline. */
  readonly overlineIcon?: LucideIcon;
  /** A short line under the title that states what the screen is for. */
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
  /** Sets the wordmark, centred, above the title: the main tabs carry the brand at their top. */
  readonly brand?: boolean;
}

/**
 * The bold title that opens a top-level tab. As the page scrolls it
 * drifts up a little slower than the content and fades, handing off to the compact title.
 */
export function LargeTitle({
  title,
  overline,
  overlineIcon,
  subtitle,
  trailing,
  brand = false,
}: LargeTitleProps) {
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
      {/* Overline, then the huge title sharing a line with its circular actions; any subtitle
          gets the full width beneath, so nothing wraps into a ragged line beside the buttons. */}
      {brand ? (
        <Animated.View style={[styles.brandRow, textStyle]}>
          <Wordmark height={22} />
        </Animated.View>
      ) : null}
      {overline ? (
        <Animated.View style={[styles.overlineRow, textStyle]}>
          <Overline label={overline} icon={overlineIcon} />
        </Animated.View>
      ) : null}
      <View style={styles.largeRow}>
        <Animated.View style={[styles.largeText, textStyle]}>
          <SWText variant="displayTitle" accessibilityRole="header" numberOfLines={1}>
            {title}
          </SWText>
        </Animated.View>
        {trailing}
      </View>
      {subtitle ? (
        <Animated.View style={textStyle}>
          <SWText variant="bodySmall" tone="textMuted">
            {subtitle}
          </SWText>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Below this, the screen has no status bar over it: it is presented as a sheet. */
const sheetTopInset = tokens.spacing[5];

const stylesFor = themedStyles(() => ({
  wrap: {
    position: 'relative',
  },
  barLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  // The controls sit on the page gutter, so the back button lines up with the content below.
  nav: {
    minHeight: tokens.layout.headerCompact,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  // Concentric with the sheet's corner: the button sits as far from the top edge as from the
  // side, so it follows the curve instead of crowding it.
  navInSheet: {
    paddingTop:
      tokens.layout.pageGutterCompact -
      (tokens.layout.headerCompact - tokens.focus.minimumTarget) / 2,
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
    gap: tokens.spacing[1],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[6],
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: tokens.spacing[3],
  },
  overlineRow: {
    marginBottom: tokens.spacing[1],
  },
  largeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  largeText: {
    flex: 1,
  },
}));
