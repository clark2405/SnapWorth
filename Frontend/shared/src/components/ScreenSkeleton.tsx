import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  useWideLayout,
  type Place,
} from '../design';
import { ScreenPresenceContext } from './backdrop-host';

export interface ScreenSkeletonProps {
  /**
   * A tab opens on its colour band and a list; a listing, post or item on a photo and details;
   * any other screen (settings, search) on a few lines.
   */
  readonly kind: 'tab' | 'detail' | 'page';
  /** The place whose colour a tab's band takes. */
  readonly place?: Place;
}

/**
 * The shape of a screen in soft blocks, shown the first moment a screen's code is still on its
 * way (the web loads each screen when it's first opened). It sits beneath the screen, so the real
 * one simply covers it when it draws; it only appears after a beat, so a quick load never flashes it.
 */
export function ScreenSkeleton({ kind, place }: ScreenSkeletonProps) {
  const focused = useIsFocused();
  if (!focused) return null;
  return <Skeleton kind={kind} place={place} />;
}

/**
 * A screen with its skeleton beneath it until the screen has drawn: then the skeleton leaves, so
 * it's never painted under a page, and a page with a clear background shows what's behind it.
 */
export function WithSkeleton({
  children,
  ...skeleton
}: ScreenSkeletonProps & { readonly children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const arrived = useCallback(() => setReady(true), []);
  return (
    <ScreenPresenceContext.Provider value={arrived}>
      {ready ? null : <ScreenSkeleton {...skeleton} />}
      {children}
    </ScreenPresenceContext.Provider>
  );
}

/** How long a load can take before the skeleton shows at all. */
const showAfterMs = 140;
const pulseMs = 900;

function Skeleton({ kind, place }: ScreenSkeletonProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const wide = useWideLayout();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withDelay(
      showAfterMs,
      withTiming(1, { duration: 200 }, () => {
        if (reduceMotion) return;
        // A few slow breaths and then still: it's covered as soon as the screen draws, and must
        // not keep animating beneath it.
        shown.value = withRepeat(
          withTiming(0.55, { duration: pulseMs, easing: Easing.inOut(Easing.sin) }),
          6,
          true,
        );
      }),
    );
    return () => cancelAnimation(shown);
  }, [reduceMotion, shown]);

  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  const band = place ? placeColors(colors, place).fill : colors.sunken;
  const column = wide ? tokens.layout.wideColumn : tokens.layout.phoneColumn;
  const content = Math.min(width, column) - tokens.layout.pageGutterCompact * 2;
  const columns = wide ? Math.max(1, Math.min(3, Math.floor(content / 300))) : 1;
  const card = (content - tokens.spacing[6] * (columns - 1)) / columns;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.root, fade]}
    >
      {kind === 'tab' ? (
        <>
          <View style={[styles.band, { backgroundColor: band }]}>
            <View style={[styles.column, { maxWidth: column }]}>
              <View style={[styles.bar, styles.onBand, { width: 160, height: 34 }]} />
            </View>
          </View>
          <View style={[styles.column, styles.body, { maxWidth: column }]}>
            <View style={[styles.block, { height: 72 }]} />
            <View style={styles.row}>
              {Array.from({ length: wide ? 5 : 3 }, (_, index) => (
                <View key={index} style={[styles.block, styles.tile]} />
              ))}
            </View>
            <View style={styles.row}>
              {Array.from({ length: columns }, (_, index) => (
                <View key={index} style={{ width: card, gap: tokens.spacing[3] }}>
                  <View style={[styles.block, { height: card * 0.75 }]} />
                  <View style={[styles.bar, { width: '70%' }]} />
                  <View style={[styles.bar, { width: '45%' }]} />
                </View>
              ))}
            </View>
          </View>
        </>
      ) : kind === 'page' ? (
        <View style={[styles.column, styles.detail, { maxWidth: tokens.layout.readingColumn }]}>
          <View style={[styles.bar, { width: '40%', height: 28 }]} />
          <View style={[styles.block, { height: 160 }]} />
          <View style={[styles.bar, { width: '85%' }]} />
          <View style={[styles.bar, { width: '65%' }]} />
          <View style={[styles.block, { height: 120 }]} />
        </View>
      ) : (
        <View
          style={[
            styles.column,
            styles.detail,
            wide ? styles.detailWide : null,
            { maxWidth: wide ? tokens.layout.wideColumn : column },
          ]}
        >
          <View
            style={[styles.block, wide ? styles.photoWide : { height: Math.round(width * 0.8) }]}
          />
          <View style={[styles.lines, wide ? styles.linesWide : null]}>
            <View style={[styles.bar, { width: '35%' }]} />
            <View style={[styles.bar, { width: '60%', height: 28 }]} />
            <View style={[styles.block, { height: 120 }]} />
            <View style={[styles.bar, { width: '90%' }]} />
            <View style={[styles.bar, { width: '75%' }]} />
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  band: {
    paddingTop: tokens.spacing[16],
    paddingBottom: tokens.spacing[6],
  },
  column: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  body: {
    paddingTop: tokens.spacing[6],
    gap: tokens.spacing[6],
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[6],
    overflow: 'hidden',
  },
  block: {
    borderRadius: tokens.radius.large,
    backgroundColor: colors.sunken,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
  },
  tile: {
    width: 116,
    height: 116,
  },
  bar: {
    height: 14,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  onBand: {
    backgroundColor: colors.canvas,
    opacity: 0.35,
  },
  detail: {
    paddingTop: tokens.layout.headerCompact + tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  detailWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[8],
  },
  photoWide: {
    flex: tokens.layout.detailMediaFlex,
    aspectRatio: 1,
  },
  lines: {
    gap: tokens.spacing[4],
  },
  linesWide: {
    flex: tokens.layout.detailBodyFlex,
  },
}));
