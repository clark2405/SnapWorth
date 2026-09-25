import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CompanionOrb, SWText } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';

const exitCurve = tokens.motion.bezier.exit;
const exitEasing = Easing.bezier(
  exitCurve[0] ?? 0,
  exitCurve[1] ?? 0,
  exitCurve[2] ?? 1,
  exitCurve[3] ?? 1,
);

export interface SplashViewProps {
  /** True once fonts and anything else the first route needs have loaded. */
  readonly ready: boolean;
  /** Called as the splash starts to clear, so the first route can begin its entrance. */
  readonly onExit?: () => void;
  /** Called once the splash has fully cleared and can unmount. */
  readonly onDone: () => void;
}

/**
 * The launch screen. Worthy springs into place, the wordmark rises in beneath it, then the
 * whole splash scales up a hair and fades as the first route takes over. It never waits longer
 * than the app needs plus a short hold, and a tap skips the hold.
 */
export function SplashView({ ready, onExit, onDone }: SplashViewProps) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const orbScale = useSharedValue(reduceMotion ? 1 : 0.5);
  const orbFade = useSharedValue(reduceMotion ? 1 : 0);
  const word = useSharedValue(reduceMotion ? 1 : 0);
  const exit = useSharedValue(1);
  const [held, setHeld] = useState(false);
  const exiting = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (reduceMotion) {
      orbScale.value = 1;
      orbFade.value = 1;
      word.value = 1;
    } else {
      orbScale.value = withSpring(1, tokens.motion.spring.playful);
      orbFade.value = withTiming(1, { duration: 260 });
      word.value = withDelay(320, withSpring(1, tokens.motion.spring.gentle));
    }
    const timer = setTimeout(() => setHeld(true), tokens.motion.duration.launchMinimumHold);
    return () => clearTimeout(timer);
  }, [orbFade, orbScale, ready, reduceMotion, word]);

  const leave = useCallback(() => {
    if (exiting.current || !ready) return;
    exiting.current = true;
    onExit?.();
    exit.value = withTiming(
      0,
      {
        duration: reduceMotion
          ? tokens.motion.recipe.reducedCrossFade.durationMs
          : tokens.motion.recipe.dismiss.durationMs,
        easing: exitEasing,
      },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
  }, [exit, onDone, onExit, ready, reduceMotion]);

  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    if (ready && held) leaveRef.current();
  }, [ready, held]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: exit.value,
    transform: [{ scale: interpolate(exit.value, [0, 1], [1.04, 1]) }],
  }));
  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbFade.value,
    transform: [{ scale: orbScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [
      { translateY: interpolate(word.value, [0, 1], [tokens.motion.entrance.offsetY, 0]) },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
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
          <Animated.View style={orbStyle}>
            <CompanionOrb size={96} />
          </Animated.View>
          <Animated.View style={[styles.words, wordStyle]}>
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

const stylesFor = themedStyles((colors) => ({
  root: {
    backgroundColor: colors.canvas,
    zIndex: tokens.artDirection.planes.sheet,
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[6],
    padding: tokens.layout.pageGutterCompact,
  },
  words: {
    gap: tokens.spacing[2],
  },
}));
