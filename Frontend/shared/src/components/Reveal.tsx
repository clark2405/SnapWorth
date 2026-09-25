import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
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

const RevealGateContext = createContext(true);

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
}

/**
 * Entrance motion: content rises a short distance and settles in one long, decelerating beat,
 * cascading 50ms per sibling. Transform and opacity only, never scale, so type stays crisp.
 * With reduced motion it becomes a short cross-fade with no travel.
 */
export function Reveal({ children, index = 0, style, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const gateOpen = useContext(RevealGateContext);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!gateOpen) return;
    const { limits, recipe } = tokens.motion;
    const slot = Math.min(index, limits.maximumStaggerItems - 1);
    progress.value = reduceMotion
      ? withTiming(1, { duration: recipe.reducedCrossFade.durationMs })
      : withDelay(
          delay + slot * limits.staggerInterval,
          withTiming(1, { duration: recipe.entrance.durationMs, easing: expressive }),
        );
  }, [delay, gateOpen, index, progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - progress.value) * tokens.motion.entrance.offsetY }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
