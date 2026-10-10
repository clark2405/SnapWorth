import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  const inSheet = insets.top < sheetTopInset;
  // A sheet's header is taller by the margin under the sheet's top edge.
  const barHeight = tokens.layout.headerCompact + (inSheet ? sheetNavMargin : 0);

  // The edge's blur and wash grow in with the scroll (see ScrollEdge's `progress`). A banded
  // bar keeps its edge from the start, except in a sheet: nothing lies under the bar there
  // until the content scrolls, and an edge at rest would only blur the first line.
  const edgeAtRest = banded && !inSheet;
  const presence = useDerivedValue(() => {
    const y = scroll?.scrollY.value ?? 0;
    return interpolate(y, [0, 64], [edgeAtRest ? 1 : 0, 1], Extrapolation.CLAMP);
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
      <View style={[styles.barLayer, { top: -insets.top }]}>
        <ScrollEdge solid={insets.top + barHeight} progress={presence} />
      </View>
      {/* In a sheet there is no status bar above the header, so it brings its own top margin
          rather than sitting on the sheet's rounded edge. */}
      <View style={[styles.nav, inSheet ? styles.navInSheet : null]}>
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
      {brand ? <BrandRefresh /> : null}
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

/** How far a pull goes before the page reloads; the lens makes one full turn by then. */
const refreshPull = 96;
/** One reload wave, through the whole word and the lens's turn. */
const waveMs = 1100;

/**
 * The wordmark atop a main tab, which doubles as its pull-to-refresh indicator, the way Threads
 * and Instagram turn their marks into theirs. Pulled, it holds its place while the page stretches
 * away beneath it, growing a little and turning its lens with the pull. While the page reloads a
 * wave keeps rolling through the word until the new content is in, then the letters settle back
 * into the wordmark.
 */
function BrandRefresh() {
  const scroll = useScreenScroll();
  const styles = useThemedStyles(stylesFor);
  const cycle = useSharedValue(0);
  const wave = useSharedValue(0);
  const dim = useSharedValue(1);
  const refreshing = scroll?.refreshing;
  // With Reduce Motion on, nothing moves on its own: the wordmark dims and brightens instead.
  const reduceMotion = useReducedMotion();

  useAnimatedReaction(
    () => refreshing?.value ?? 0,
    (now, before) => {
      if (now === before || before === null) return;
      if (reduceMotion) {
        dim.value =
          now === 1
            ? withRepeat(withTiming(0.4, { duration: waveMs / 2 }), -1, true)
            : withTiming(1, { duration: tokens.motion.duration.base });
        return;
      }
      if (now === 1) {
        cancelAnimation(cycle);
        cycle.value = 0;
        cycle.value = withRepeat(
          withTiming(360, { duration: waveMs, easing: Easing.linear }),
          -1,
          false,
        );
        wave.value = withTiming(1, { duration: tokens.motion.duration.base });
      } else {
        // Finish the wave in flight rather than cutting it, so the letters land together.
        const settle = {
          duration: tokens.motion.duration.reveal,
          easing: Easing.out(Easing.cubic),
        };
        cycle.value = withTiming(Math.ceil(cycle.value / 360) * 360, settle, (finished) => {
          if (finished) cycle.value = 0;
        });
        wave.value = withTiming(0, settle);
      }
    },
    [reduceMotion],
  );

  const pull = useDerivedValue(() => Math.max(0, -(scroll?.scrollY.value ?? 0)) / refreshPull);
  const motion = useMemo(() => ({ pull, cycle, wave }), [cycle, pull, wave]);

  const rowStyle = useAnimatedStyle(() => {
    const y = scroll?.scrollY.value ?? 0;
    const edge = scroll?.titleEdge.value ?? 80;
    return {
      opacity: interpolate(y, [0, edge * 0.8], [1, 0], Extrapolation.CLAMP) * dim.value,
      // Pulled down, the wordmark holds its place and the page stretches beneath it, the mark
      // growing a little as it goes; scrolled up, it drifts away with the title.
      transform: [
        { translateY: y < 0 ? y : interpolate(y, [0, edge], [0, edge * 0.3]) },
        { scale: 1 + 0.14 * Math.min(pull.value, 1) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.brandRow, rowStyle]}>
      <Wordmark height={22} motion={scroll?.refreshable ? motion : undefined} />
    </Animated.View>
  );
}

/** Below this, the screen has no status bar over it: it is presented as a sheet. */
const sheetTopInset = tokens.spacing[5];
// Concentric with the sheet's corner: the button sits as far from the top edge as from the
// side, so it follows the curve instead of crowding it.
const sheetNavMargin =
  tokens.layout.pageGutterCompact - (tokens.layout.headerCompact - tokens.focus.minimumTarget) / 2;

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
  navInSheet: {
    paddingTop: sheetNavMargin,
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
