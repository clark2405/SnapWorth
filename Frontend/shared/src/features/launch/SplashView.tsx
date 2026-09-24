import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SWText } from '../../components';
import { tokens, useMotionPreference } from '../../design';

const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
const exitCurve = tokens.motion.bezier.exit;
const exitEasing = Easing.bezier(
  exitCurve[0] ?? 0,
  exitCurve[1] ?? 0,
  exitCurve[2] ?? 1,
  exitCurve[3] ?? 1,
);
const useNativeDriver = Platform.OS !== 'web';

const corners = [
  { key: 'topLeft', x: -1, y: -1 },
  { key: 'topRight', x: 1, y: -1 },
  { key: 'bottomLeft', x: -1, y: 1 },
  { key: 'bottomRight', x: 1, y: 1 },
] as const;

export interface SplashViewProps {
  /** True once fonts and anything else the first route needs have loaded. */
  readonly ready: boolean;
  /** Called as the splash starts to clear, so the first route can begin its entrance. */
  readonly onExit?: () => void;
  /** Called once the splash has fully cleared and can unmount. */
  readonly onDone: () => void;
}

/**
 * The launch screen. It tells the product's story in one gesture: a viewfinder closes onto an
 * item, the way a capture does, then the name settles beneath it. It never waits longer than
 * the app needs plus a short hold, and a tap skips the hold.
 */
export function SplashView({ ready, onExit, onDone }: SplashViewProps) {
  const { reduceMotion, preferenceResolved } = useMotionPreference();
  const entrance = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const [held, setHeld] = useState(false);
  const exiting = useRef(false);

  // Start only once fonts are in, so the name never swaps typeface mid-fade.
  useEffect(() => {
    if (!preferenceResolved || !ready) return;
    const animation = reduceMotion
      ? Animated.timing(entrance, { toValue: 1, duration: 0, useNativeDriver })
      : Animated.timing(entrance, {
          toValue: 1,
          duration: tokens.motion.duration.launchEntrance,
          easing: expressive,
          useNativeDriver,
        });
    animation.start();
    const timer = setTimeout(() => setHeld(true), tokens.motion.duration.launchMinimumHold);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [entrance, preferenceResolved, ready, reduceMotion]);

  const leave = () => {
    if (exiting.current || !ready) return;
    exiting.current = true;
    onExit?.();
    Animated.timing(exit, {
      toValue: 0,
      duration: reduceMotion
        ? tokens.motion.recipe.reducedCrossFade.durationMs
        : tokens.motion.recipe.dismiss.durationMs,
      easing: exitEasing,
      useNativeDriver,
    }).start(() => onDone());
  };

  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    if (ready && held) leaveRef.current();
  }, [ready, held]);

  // Brackets travel in from a wider frame during the first 60% of the sequence.
  const bracketTravel = entrance.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [tokens.spacing[4], 0, 0],
  });
  const bracketOpacity = entrance.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  });
  const itemScale = entrance.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [0.4, 0.4, 1, 1],
  });
  const itemOpacity = entrance.interpolate({
    inputRange: [0, 0.35, 0.6, 1],
    outputRange: [0, 0, 1, 1],
  });
  const wordOpacity = entrance.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });
  const wordTravel = entrance.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [tokens.motion.entrance.offsetY, tokens.motion.entrance.offsetY, 0],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}
      pointerEvents={exiting.current ? 'none' : 'auto'}
    >
      <Pressable
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="SnapWorth is starting"
        accessibilityLiveRegion="polite"
        onPress={leave}
        style={styles.fill}
      >
        <View style={styles.center}>
          <View style={styles.mark}>
            {corners.map((corner) => (
              <Animated.View
                key={corner.key}
                style={[
                  styles.bracket,
                  styles[corner.key],
                  {
                    opacity: bracketOpacity,
                    transform: reduceMotion
                      ? []
                      : [
                          { translateX: Animated.multiply(bracketTravel, corner.x) },
                          { translateY: Animated.multiply(bracketTravel, corner.y) },
                        ],
                  },
                ]}
              />
            ))}
            <Animated.View
              style={[
                styles.item,
                {
                  opacity: itemOpacity,
                  transform: reduceMotion ? [] : [{ scale: itemScale }],
                },
              ]}
            />
          </View>

          <Animated.View
            style={[
              styles.words,
              {
                opacity: wordOpacity,
                transform: reduceMotion ? [] : [{ translateY: wordTravel }],
              },
            ]}
          >
            <SWText variant="displayTitle" align="center">
              SnapWorth
            </SWText>
            <SWText variant="bodySmall" tone="textMuted" align="center">
              Know what it&apos;s worth.
            </SWText>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const mark = tokens.layout.launchMark;
const bracket = tokens.layout.viewfinderBracket;
const stroke = tokens.layout.progressSegment;

const styles = StyleSheet.create({
  root: {
    backgroundColor: tokens.color.dark.canvas,
    zIndex: tokens.artDirection.planes.sheet,
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[8],
    padding: tokens.layout.pageGutterCompact,
  },
  mark: {
    width: mark,
    height: mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracket: {
    position: 'absolute',
    width: bracket,
    height: bracket,
    borderColor: tokens.color.dark.accent,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke },
  topRight: { top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke },
  item: {
    width: mark / 3,
    height: mark / 3,
    borderRadius: tokens.radius.small,
    backgroundColor: tokens.color.dark.textPrimary,
  },
  words: {
    gap: tokens.spacing[2],
  },
});
