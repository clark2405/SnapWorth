import { useIsFocused, useIsPreview, useScrollToTop } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  haptic,
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  useWideLayout,
  type Place,
} from '../design';
import { AmbientBackdrop, useBackdropClaim, type AmbientBackdropProps } from './AmbientBackdrop';
import { BackdropHostContext, ScreenPresenceContext } from './backdrop-host';
import { useScreenVisibility } from './screen-visibility';
import { ScrollEdge } from './ScrollEdge';
import { contentScrolling, onScrollToTopRequest, tabBarFolded } from './scroll-signal';
import { SWText } from './SWText';

/** The shortest a pull-to-refresh shows itself reloading: one pass of the wordmark's wave. */
const minimumRefreshMs = 1200;

interface ScreenScrollState {
  readonly scrollY: SharedValue<number>;
  /** Content offset where the large title has fully passed under the compact bar. */
  readonly titleEdge: SharedValue<number>;
  readonly setCompactTitle: (title: string | null) => void;
  readonly hasHeader: boolean;
  /** How far the content sits below offset zero, where iOS insets it (see `bare` below). */
  readonly offsetBase: number;
  /** 1 while a pull-to-refresh is reloading the page, for the wordmark that shows it. */
  readonly refreshing: SharedValue<number>;
  /** Whether the page can be pulled to refresh. */
  readonly refreshable: boolean;
  /** The place a tab opens on, whose colour block its large title sits in. */
  readonly place: Place | null;
}

const ScreenScrollContext = createContext<ScreenScrollState | null>(null);

/** Scroll position of the enclosing `Screen`, for headers and parallax. */
export function useScreenScroll(): ScreenScrollState | null {
  return useContext(ScreenScrollContext);
}

export interface ScreenProps {
  readonly children: ReactNode;
  /** Pinned over the top of the scroll area; content scrolls beneath it. */
  readonly header?: ReactNode;
  /** Pinned over the bottom edge as floating glass: composers and action bars. */
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
  /** Extra bottom room so content can scroll clear of the floating tab bar. */
  readonly clearTabBar?: boolean;
  readonly contentStyle?: StyleProp<ViewStyle>;
  /** Which area's warm blobs drift behind the screen. Every screen has them; tabs re-tint. */
  readonly ambient?: AmbientBackdropProps['mood'];
  /**
   * A quiet screen with room to spare, such as logging in: the backdrop's print covers the whole
   * page. Otherwise it keeps to the edges, out from behind busy content.
   */
  readonly quiet?: boolean;
  /** Enables pull-to-refresh. Resolve the promise when the new content is in. */
  readonly onRefresh?: () => Promise<void> | void;
  /**
   * Lets the content run under the status bar and floating header, e.g. a full-bleed hero
   * photo. Otherwise any `contentStyle.paddingTop` is added below the header's clearance.
   */
  readonly bleedTop?: boolean;
  /** Drops the canvas so a screen can fade its own background in over the one beneath. */
  readonly transparent?: boolean;
  /** Lets a screen scroll itself, e.g. to bring a just-posted comment into view. */
  readonly scrollRef?: RefObject<Animated.ScrollView | null>;
  /**
   * The screen is the content of a sheet. There is no status bar above it, so nothing inside
   * keeps clear of one, and the footer rests on the sheet's own colour so the page never shows
   * through beneath the floating bar.
   */
  readonly sheet?: boolean;
  /**
   * The place a tab opens on. Its large title sits in a block of the place's colour, the
   * compact bar keeps that colour, and the status bar reads against it.
   */
  readonly place?: Place;
  /**
   * How wide the content may grow on a wide web window. Tabs spread out (`wide`); screens opened
   * from one keep to a reading width unless they lay themselves out in columns: a detail page
   * (`split`, see `DetailLayout`) is wide, and its footer sits under its details column.
   */
  readonly width?: 'reading' | 'wide' | 'split';
}

/**
 * The shell every screen sits in. Headers and footers float as glass over the content, so the
 * page scrolls beneath them; a large title in the content hands off to a compact title as it
 * scrolls away, the way system apps do.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  clearTabBar = false,
  contentStyle,
  ambient = 'calm',
  quiet = false,
  onRefresh,
  bleedTop = false,
  transparent = false,
  scrollRef,
  sheet = false,
  place,
  width,
}: ScreenProps) {
  const deviceInsets = useSafeAreaInsets();
  // A wide web window has a sidebar instead of the floating tab bar, and room for wider content:
  // a tab spreads out to grids, a screen opened from one keeps to a reading width.
  const wide = useWideLayout() && !sheet;
  const columnWidth = wide
    ? (width ?? (clearTabBar ? 'wide' : 'reading')) === 'reading'
      ? tokens.layout.readingColumn
      : tokens.layout.wideColumn
    : tokens.layout.phoneColumn;
  const footerBeside = wide && width === 'split';
  // A photo that runs up under the header is a phone's full-bleed hero; on a wide window it's
  // framed in a column instead, so the page starts below the header like any other.
  const bleeds = bleedTop && !wide;
  const insets = useMemo(
    () => (sheet ? { ...deviceInsets, top: 0 } : deviceInsets),
    [deviceInsets, sheet],
  );
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const scrollY = useSharedValue(0);
  const titleEdge = useSharedValue<number>(tokens.spacing[16]);
  const [compactTitle, setCompactTitle] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  // Headers vary (a search field plus scopes is taller than a title bar), so measure it.
  const [headerHeight, setHeaderHeight] = useState<number>(tokens.layout.headerCompact);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingValue = useSharedValue(0);
  const ownScrollRef = useRef<Animated.ScrollView>(null);
  const scrollerRef = scrollRef ?? ownScrollRef;

  // iOS 26 only minimises the tab bar over a scroll view that is the tab's top-level view and
  // lets iOS manage its insets. So on iOS a tab page renders its scroll view bare, with the
  // floating header beside it rather than a wrapper around both, and iOS insets it from the
  // status bar and the tab bar. Offsets then start at minus the top inset; `offsetBase` brings
  // them back to zero at rest for everything that reads the scroll position.
  const bare = Platform.OS === 'ios' && scroll && !transparent && clearTabBar && !footer;
  const offsetBase = bare ? insets.top : 0;
  const base = useSharedValue(offsetBase);
  // The scroll view's own last offset. The top inset can settle after the first scroll event on a
  // tab's first open, so when it changes the position is worked out again from the offset;
  // otherwise the page reads as pulled down by the inset until the next scroll, and the wordmark,
  // which follows a pull, sits up under the status bar.
  const rawOffset = useSharedValue<number | null>(null);
  useEffect(() => {
    base.value = offsetBase;
    if (rawOffset.value !== null) scrollY.value = rawOffset.value + offsetBase;
  }, [base, offsetBase, rawOffset, scrollY]);

  // Tapping the tab you are already on brings its page back to the top, as in every system app.
  // Native tabs announce the repeat tap through the navigator; the web's tab bar asks directly.
  const topTarget = useMemo(
    () => ({
      get current() {
        const node = scrollerRef.current;
        if (!node) return null;
        return {
          scrollTo: (to: { y?: number; animated?: boolean }) =>
            node.scrollTo({ ...to, y: (to.y ?? 0) - offsetBase }),
        };
      },
    }),
    [offsetBase, scrollerRef],
  );
  // A screen shown as a link preview is not in the navigator, so it doesn't listen for taps.
  const isPreview = useIsPreview();
  // A link preview isn't in the navigator, so it never counts as focused; it's always shown.
  const focusedHere = useIsFocused();
  const visibility = useScreenVisibility(focusedHere || isPreview);
  useEffect(() => {
    if (!clearTabBar || Platform.OS !== 'web') return;
    return onScrollToTopRequest(() => scrollerRef.current?.scrollTo({ y: 0, animated: true }));
  }, [clearTabBar, scrollerRef]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event, context: { lastY?: number }) => {
      rawOffset.value = event.contentOffset.y;
      const y = event.contentOffset.y + base.value;
      const delta = y - (context.lastY ?? y);
      context.lastY = y;
      scrollY.value = y;
      // Any scroll steps floating chrome (Worthy) aside, and brings it back ~1s after the page
      // stops. Each event restarts the sequence, so it only returns once scrolling has settled.
      if (Math.abs(delta) > 2 && y > 40) {
        contentScrolling.value = withSequence(
          withTiming(1, { duration: tokens.motion.duration.base }),
          withDelay(1000, withTiming(0, { duration: tokens.motion.duration.reveal })),
        );
      } else if (y <= 40) {
        contentScrolling.value = withTiming(0, { duration: tokens.motion.duration.stepTransition });
      }
      // A tab's page folds the tab bar on the way down and opens it on any way back up.
      if (clearTabBar) {
        if (y <= 40 || delta < -6) tabBarFolded.value = 0;
        else if (delta > 6 && y > 80) tabBarFolded.value = 1;
      }
    },
  });

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    haptic('select');
    setRefreshing(true);
    refreshingValue.value = 1;
    try {
      // The wordmark's reload wave runs through the word at least once, so even a quick reload
      // reads as one rather than a flicker.
      await Promise.all([
        onRefresh(),
        new Promise((resolve) => setTimeout(resolve, minimumRefreshMs)),
      ]);
    } finally {
      setRefreshing(false);
      refreshingValue.value = 0;
      haptic('success');
    }
  }, [onRefresh, refreshingValue]);

  const context = useMemo<ScreenScrollState>(
    () => ({
      scrollY,
      titleEdge,
      setCompactTitle,
      hasHeader: Boolean(header),
      offsetBase,
      refreshing: refreshingValue,
      refreshable: Boolean(onRefresh),
      place: place ?? null,
    }),
    [header, offsetBase, onRefresh, place, refreshingValue, scrollY, titleEdge],
  );

  const clearance = insets.top + (header ? headerHeight : 0);
  const extraTop = Number(StyleSheet.flatten(contentStyle)?.paddingTop ?? 0);
  const topRoom = bleeds ? extraTop : clearance + extraTop;
  // Exactly the room the bottom chrome takes, plus a little air: iOS 26's floating tab bar and
  // its Snap accessory sit a fixed distance from the screen edge; Android's navigation bar sits
  // on the inset with the Snap bar above it; the web draws its own floating bar. A footer
  // (BottomBar) measures itself and keeps clear of the home indicator on its own.
  const tabBarRoom = Platform.select({
    ios: tokens.layout.nativeTabBarClearance,
    android: insets.bottom + tokens.layout.androidTabBarClearance,
    default: insets.bottom + tokens.layout.floatingTabBarClearance + tokens.spacing[4],
  });
  const bottomRoom = bare
    ? tokens.spacing[4]
    : clearTabBar && !wide
      ? tabBarRoom + tokens.spacing[4]
      : (footer ? footerHeight : insets.bottom) + tokens.spacing[8];

  // On a wide window the scroll area fills the window, so its scrollbar sits at the edge and a
  // tab's colour band can run edge to edge, while the content keeps to its column in the middle.
  const capped = wide
    ? { width: '100%' as const, maxWidth: columnWidth, alignSelf: 'center' as const }
    : null;
  const body = [
    styles.content,
    capped,
    contentStyle,
    { paddingTop: topRoom - offsetBase, paddingBottom: bottomRoom },
  ];

  // A bare tab page carries its backdrop inside the scroll view, held still against it, so the
  // scroll view can come first. Only there: inside a form sheet the same layer covers the content.
  const backdropInScroll = bare;
  const print = quiet ? 'full' : 'edges';
  // Under a shared backdrop (the web's tabs) the page stays clear and only names its look.
  const hosted = useContext(BackdropHostContext) && !transparent;
  useBackdropClaim(ambient, print, hosted);
  const present = useContext(ScreenPresenceContext);
  useEffect(() => {
    present?.();
  }, [present]);

  const scroller = scroll ? (
    <Animated.ScrollView
      ref={scrollerRef}
      style={bare ? [styles.column, styles.canvas] : styles.fill}
      contentContainerStyle={body}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior={bare ? 'automatic' : 'never'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            // On iOS the wordmark's lens is the indicator (see LargeTitle), so the system spinner
            // stays out of sight; Android's spinner takes the brand accent.
            tintColor={Platform.OS === 'ios' ? 'transparent' : colors.textMuted}
            colors={[colors.accent]}
            progressViewOffset={clearance - offsetBase}
          />
        ) : undefined
      }
    >
      {backdropInScroll ? (
        <PinnedBackdrop mood={ambient} print={print} scrollY={scrollY} base={base} />
      ) : null}
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={[styles.fill, body]}>{children}</View>
  );

  const top = header ? (
    <View
      style={[styles.header, { paddingTop: insets.top }]}
      onLayout={(event) =>
        setHeaderHeight(Math.round(event.nativeEvent.layout.height - insets.top))
      }
    >
      {header}
    </View>
  ) : (
    <CompactTitleBar title={compactTitle} topInset={insets.top} />
  );

  const tabTap = isPreview ? null : (
    <>
      <ScrollToTopOnTabTap target={topTarget} />
      {place ? <PlaceStatusBar place={place} scrollY={scrollY} titleEdge={titleEdge} /> : null}
    </>
  );

  if (bare) {
    return (
      <ScreenScrollContext.Provider value={context}>
        {scroller}
        {top}
        {tabTap}
      </ScreenScrollContext.Provider>
    );
  }

  const page = (
    <ScreenScrollContext.Provider value={context}>
      <View style={[styles.root, transparent || hosted ? styles.clear : null]} {...visibility}>
        {transparent || hosted || backdropInScroll ? null : (
          <AmbientBackdrop mood={ambient} print={print} />
        )}
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.column, wide ? styles.columnWide : { maxWidth: columnWidth }]}>
            {scroller}
            {footer ? (
              <View
                style={[
                  styles.footer,
                  wide ? [styles.footerCentred, { maxWidth: columnWidth }] : null,
                  footerBeside ? styles.footerBeside : null,
                ]}
                onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              >
                {sheet ? <SheetFooterBase /> : null}
                {footerBeside ? (
                  // Under the details column of a split page, in the same proportions.
                  <>
                    <View style={styles.footerMedia} />
                    <View style={styles.footerBody}>{footer}</View>
                  </>
                ) : (
                  footer
                )}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
        {top}
        {tabTap}
      </View>
    </ScreenScrollContext.Provider>
  );

  // Headers and bars inside read the insets themselves, so a sheet hands them its own.
  return sheet ? (
    <SafeAreaInsetsContext.Provider value={insets}>{page}</SafeAreaInsetsContext.Provider>
  ) : (
    page
  );
}

/**
 * The sheet's colour under its footer, fading in from above the bar, so content scrolling past
 * disappears behind the bar instead of showing in the margin beneath and beside it.
 */
function SheetFooterBase() {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const id = `footer-${useId().replace(/:/g, '')}`;
  return (
    <View pointerEvents="none" style={styles.footerBase}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.canvas} stopOpacity={0} />
            <Stop offset="0.45" stopColor={colors.canvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Listens for a tap on the tab that is already open; it draws nothing. */
function ScrollToTopOnTabTap({
  target,
}: {
  readonly target: Parameters<typeof useScrollToTop>[0];
}) {
  useScrollToTop(target);
  return null;
}

/**
 * While a place's tab is in front and its colour block is under the status bar, the status bar
 * reads against the block. Once the block has scrolled away, or the tab is left, it is the
 * app's own again.
 */
function PlaceStatusBar({
  place,
  scrollY,
  titleEdge,
}: {
  readonly place: Place;
  readonly scrollY: SharedValue<number>;
  readonly titleEdge: SharedValue<number>;
}) {
  const focused = useIsFocused();
  const { colors, isDark } = useTheme();
  const dark = placeColors(colors, place).dark;
  const [onBlock, setOnBlock] = useState(true);
  // The compact bar has mostly grown in over the page by then.
  useAnimatedReaction(
    () => scrollY.value < titleEdge.value - 40,
    (now, before) => {
      if (now !== before) runOnJS(setOnBlock)(now);
    },
  );
  useEffect(() => {
    if (!focused || Platform.OS === 'web') return;
    const light = onBlock ? dark : isDark;
    StatusBar.setBarStyle(light ? 'light-content' : 'dark-content', true);
    return () => StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
  }, [dark, focused, isDark, onBlock]);
  return null;
}

/** The ambient backdrop laid inside a scroll view, moved with the offset so it stays put. */
function PinnedBackdrop({
  mood,
  print,
  scrollY,
  base,
}: {
  readonly mood: AmbientBackdropProps['mood'];
  readonly print: AmbientBackdropProps['print'];
  readonly scrollY: SharedValue<number>;
  readonly base: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const { height } = useWindowDimensions();
  const pinned = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value - base.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.pinned, { height }, pinned]}>
      <AmbientBackdrop mood={mood} print={print} />
    </Animated.View>
  );
}

/** The soft edge a large title collapses into; invisible until the title has scrolled away. */
function CompactTitleBar({
  title,
  topInset,
}: {
  readonly title: string | null;
  readonly topInset: number;
}) {
  const scroll = useScreenScroll();
  const styles = useThemedStyles(stylesFor);

  // The edge grows in over the last stretch before the large title slips under it, rather than
  // switching on as it passes.
  const presence = useDerivedValue(() => {
    const edge = scroll?.titleEdge.value ?? 64;
    const y = scroll?.scrollY.value ?? 0;
    return interpolate(y, [edge - 72, edge + 8], [0, 1], Extrapolation.CLAMP);
  });
  const titleStyle = useAnimatedStyle(() => {
    const edge = scroll?.titleEdge.value ?? 64;
    const y = scroll?.scrollY.value ?? 0;
    return {
      opacity: interpolate(y, [edge - 8, edge + 12], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [edge - 8, edge + 12], [6, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  if (!title) return null;

  return (
    <View style={styles.compact}>
      <ScrollEdge solid={topInset + tokens.layout.headerCompact} progress={presence} />
      <Animated.View style={[styles.compactTitle, { marginTop: topInset }, titleStyle]}>
        <SWText variant="headingMedium" numberOfLines={1}>
          {title}
        </SWText>
      </Animated.View>
    </View>
  );
}

/** Registers a screen's large title so the compact bar can show it once it scrolls away. */
export function useRegisterLargeTitle(title: string) {
  const scroll = useScreenScroll();
  const setCompactTitle = scroll?.setCompactTitle;
  return useCallback(
    (bottom: number) => {
      if (!scroll || !setCompactTitle) return;
      // Layout is in content coordinates; the scroll position is measured from the resting top.
      scroll.titleEdge.value = bottom + scroll.offsetBase;
      setCompactTitle(title);
    },
    [scroll, setCompactTitle, title],
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  clear: {
    backgroundColor: 'transparent',
  },
  canvas: {
    backgroundColor: colors.canvas,
  },
  pinned: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  columnWide: {
    maxWidth: '100%',
  },
  footerCentred: {
    marginHorizontal: 'auto',
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    flexGrow: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  footerBeside: {
    flexDirection: 'row',
    gap: tokens.spacing[8] - tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact - tokens.spacing[3],
  },
  footerMedia: {
    flex: tokens.layout.detailMediaFlex,
  },
  footerBody: {
    flex: tokens.layout.detailBodyFlex,
  },
  footerBase: {
    position: 'absolute',
    top: -tokens.spacing[6],
    left: 0,
    right: 0,
    bottom: 0,
  },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  compactTitle: {
    height: tokens.layout.headerCompact - tokens.spacing[1],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[16],
  },
}));
