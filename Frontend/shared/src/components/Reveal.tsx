import { useIsFocused } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '../design';

const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);

/** Slack after an entrance's last frame before its final style is applied again. */
const settleMargin = 120;

const RevealGateContext = createContext(true);
const RevealStillContext = createContext(false);

/**
 * Shows every `Reveal` beneath it already in place, with no entrance. For screens whose arrival
 * is already a motion (a zoom from the tapped card), so their content does not move twice.
 */
export function RevealStill({
  still = true,
  children,
}: {
  readonly still?: boolean;
  readonly children: ReactNode;
}) {
  return <RevealStillContext.Provider value={still}>{children}</RevealStillContext.Provider>;
}

/**
 * Holds every `Reveal` beneath it at its start state until `open` is true. The launch screen
 * uses it so the first route's entrance plays as the splash clears, not unseen behind it.
 */
export function RevealGate({
  open,
  children,
}: {
  readonly open: boolean;
  readonly children: ReactNode;
}) {
  return <RevealGateContext.Provider value={open}>{children}</RevealGateContext.Provider>;
}

export interface RevealProps {
  readonly children: ReactNode;
  /** Position in a staggered group. Items past the stagger cap enter with the last slot. */
  readonly index?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Extra wait before this group starts, e.g. to follow a hero. */
  readonly delay?: number;
  /** As a View's: `box-none` lets touches on the group's empty space reach what lies beneath. */
  readonly pointerEvents?: ViewProps['pointerEvents'];
}

/**
 * Entrance motion: content rises a short distance and settles in one long, decelerating beat,
 * cascading 50ms per sibling. Transform and opacity only, never scale, so type stays crisp.
 * With reduced motion it becomes a short cross-fade with no travel.
 */
export function Reveal({ children, index = 0, style, delay = 0, pointerEvents }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const gateOpen = useContext(RevealGateContext);
  const still = useContext(RevealStillContext);
  const focused = useIsFocused();
  // Content that mounts while its screen is out of sight (a tab filling in behind a sheet, say)
  // has no entrance anyone could see, so it starts in place.
  const offstage = useRef(!focused).current;
  const progress = useSharedValue(still || offstage ? 1 : 0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!gateOpen || still || offstage) return;
    const { limits, recipe } = tokens.motion;
    const slot = Math.min(index, limits.maximumStaggerItems - 1);
    const wait = reduceMotion ? 0 : delay + slot * limits.staggerInterval;
    const duration = reduceMotion ? recipe.reducedCrossFade.durationMs : recipe.entrance.durationMs;
    progress.value = reduceMotion
      ? withTiming(1, { duration })
      : withDelay(wait, withTiming(1, { duration, easing: expressive }));
    const done = setTimeout(() => setSettled(true), wait + duration + settleMargin);
    return () => clearTimeout(done);
  }, [delay, gateOpen, index, offstage, progress, reduceMotion, still]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - progress.value) * tokens.motion.entrance.offsetY }],
  }));

  // An animated update can miss its native view (one made while the screen is hidden, or while
  // a sheet is still sliding in). So once the entrance is over, or when there is none, the
  // content renders plainly: React commits it in place, where it can't be lost.
  const plain = still || offstage || settled;
  return (
    <Animated.View style={plain ? style : [style, animated]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
