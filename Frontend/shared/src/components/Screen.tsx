import { useIsPreview, useScrollToTop } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { AmbientBackdrop, type AmbientBackdropProps } from './AmbientBackdrop';
import { ScrollEdge } from './ScrollEdge';
import { contentScrolling, onScrollToTopRequest } from './scroll-signal';
import { SWText } from './SWText';

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
  onRefresh,
  bleedTop = false,
  transparent = false,
  scrollRef,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
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
  useEffect(() => {
    base.value = offsetBase;
  }, [base, offsetBase]);

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
  useEffect(() => {
    if (!clearTabBar || Platform.OS !== 'web') return;
    return onScrollToTopRequest(() => scrollerRef.current?.scrollTo({ y: 0, animated: true }));
  }, [clearTabBar, scrollerRef]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event, context: { lastY?: number }) => {
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
    },
  });

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    haptic('select');
    setRefreshing(true);
    refreshingValue.value = 1;
    try {
      await onRefresh();
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
    }),
    [header, offsetBase, onRefresh, refreshingValue, scrollY, titleEdge],
  );

  const clearance = insets.top + (header ? headerHeight : 0);
  const extraTop = Number(StyleSheet.flatten(contentStyle)?.paddingTop ?? 0);
  const topRoom = bleedTop ? extraTop : clearance + extraTop;
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
    : clearTabBar
      ? tabBarRoom + tokens.spacing[4]
      : (footer ? footerHeight : insets.bottom) + tokens.spacing[8];

  const body = [
    styles.content,
    contentStyle,
    { paddingTop: topRoom - offsetBase, paddingBottom: bottomRoom },
  ];

  // A bare tab page carries its backdrop inside the scroll view, held still against it, so the
  // scroll view can come first. Only there: inside a form sheet the same layer covers the content.
  const backdropInScroll = bare;

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
      {backdropInScroll ? <PinnedBackdrop mood={ambient} scrollY={scrollY} base={base} /> : null}
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

  const tabTap = isPreview ? null : <ScrollToTopOnTabTap target={topTarget} />;

  if (bare) {
    return (
      <ScreenScrollContext.Provider value={context}>
        {scroller}
        {top}
        {tabTap}
      </ScreenScrollContext.Provider>
    );
  }

  return (
    <ScreenScrollContext.Provider value={context}>
      <View style={[styles.root, transparent ? styles.clear : null]}>
        {transparent || backdropInScroll ? null : <AmbientBackdrop mood={ambient} />}
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.column}>
            {scroller}
            {footer ? (
              <View
                style={styles.footer}
                onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
        {top}
        {tabTap}
      </View>
    </ScreenScrollContext.Provider>
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

/** The ambient backdrop laid inside a scroll view, moved with the offset so it stays put. */
function PinnedBackdrop({
  mood,
  scrollY,
  base,
}: {
  readonly mood: AmbientBackdropProps['mood'];
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
      <AmbientBackdrop mood={mood} />
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
