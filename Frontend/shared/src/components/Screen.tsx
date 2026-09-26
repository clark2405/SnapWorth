import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { AmbientBackdrop, type AmbientBackdropProps } from './AmbientBackdrop';
import { ScrollEdge } from './ScrollEdge';
import { SWText } from './SWText';

interface ScreenScrollState {
  readonly scrollY: SharedValue<number>;
  /** Content offset where the large title has fully passed under the compact bar. */
  readonly titleEdge: SharedValue<number>;
  readonly setCompactTitle: (title: string | null) => void;
  readonly hasHeader: boolean;
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
  /** A soft light behind the top of the screen. Tab roots use it; flows stay quiet. */
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
  ambient = 'quiet',
  onRefresh,
  bleedTop = false,
  transparent = false,
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

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    haptic('select');
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      haptic('success');
    }
  }, [onRefresh]);

  const context = useMemo<ScreenScrollState>(
    () => ({ scrollY, titleEdge, setCompactTitle, hasHeader: Boolean(header) }),
    [header, scrollY, titleEdge],
  );

  const clearance = insets.top + (header ? headerHeight : 0);
  const extraTop = Number(StyleSheet.flatten(contentStyle)?.paddingTop ?? 0);
  const topRoom = bleedTop ? extraTop : clearance + extraTop;
  const bottomRoom =
    (clearTabBar ? tokens.layout.nativeTabBarClearance : 0) +
    (footer ? footerHeight : insets.bottom) +
    tokens.spacing[8];

  const body = [styles.content, contentStyle, { paddingTop: topRoom, paddingBottom: bottomRoom }];

  return (
    <ScreenScrollContext.Provider value={context}>
      <View style={[styles.root, transparent ? styles.clear : null]}>
        <AmbientBackdrop mood={ambient} />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.column}>
            {scroll ? (
              <Animated.ScrollView
                style={styles.fill}
                contentContainerStyle={body}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentInsetAdjustmentBehavior="never"
                refreshControl={
                  onRefresh ? (
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={refresh}
                      tintColor={colors.textMuted}
                      progressViewOffset={clearance}
                    />
                  ) : undefined
                }
              >
                {children}
              </Animated.ScrollView>
            ) : (
              <View style={[styles.fill, body]}>{children}</View>
            )}
            {footer ? (
              <View
                style={[styles.footer, { paddingBottom: insets.bottom }]}
                onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
        {header ? (
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
        )}
      </View>
    </ScreenScrollContext.Provider>
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

  const barStyle = useAnimatedStyle(() => {
    const edge = scroll?.titleEdge.value ?? 64;
    const y = scroll?.scrollY.value ?? 0;
    return { opacity: interpolate(y, [edge - 24, edge], [0, 1], Extrapolation.CLAMP) };
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
    <Animated.View style={[styles.compact, barStyle]}>
      <ScrollEdge solid={topInset + tokens.layout.headerCompact} />
      <Animated.View style={[styles.compactTitle, { marginTop: topInset }, titleStyle]}>
        <SWText variant="headingMedium" numberOfLines={1}>
          {title}
        </SWText>
      </Animated.View>
    </Animated.View>
  );
}

/** Registers a screen's large title so the compact bar can show it once it scrolls away. */
export function useRegisterLargeTitle(title: string) {
  const scroll = useScreenScroll();
  const setCompactTitle = scroll?.setCompactTitle;
  return useCallback(
    (bottom: number) => {
      if (!scroll || !setCompactTitle) return;
      scroll.titleEdge.value = bottom;
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
