import { useEffect, useRef } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '../design';

export interface PopOptions {
  /** Peak scale; below 1 makes the pop a dip, e.g. for withdrawing a like. */
  readonly peak?: number;
  /** When false, a change of `trigger` does nothing, e.g. only pop on becoming selected. */
  readonly enabled?: boolean;
}

/**
 * A scale style that swells and springs back whenever `trigger` changes, never on mount. The
 * rise is a quick timing; the return is a playful spring, so it lands with a little life.
 */
export function usePop(
  trigger: unknown,
  { peak = tokens.motion.pop.scale, enabled = true }: PopOptions = {},
) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(trigger);

  useEffect(() => {
    if (Object.is(previous.current, trigger)) return;
    previous.current = trigger;
    if (!enabled || reduceMotion) return;
    scale.value = withSequence(
      withTiming(peak, {
        duration: tokens.motion.duration.popRise,
        easing: Easing.out(Easing.quad),
      }),
      withSpring(1, tokens.motion.spring.playful),
    );
  }, [enabled, peak, reduceMotion, scale, trigger]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/**
 * Rolls a changing number into place: it arrives from below when it rises and from above when
 * it falls, so the direction of the change reads without comparing digits.
 */
export function useCountShift(count: number) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const previous = useRef(count);

  useEffect(() => {
    const delta = count - previous.current;
    previous.current = count;
    if (delta === 0 || reduceMotion) return;
    const distance = tokens.motion.countShift.offsetY;
    offset.value = delta > 0 ? distance : -distance;
    opacity.value = 0;
    offset.value = withSpring(0, tokens.motion.spring.snappy);
    opacity.value = withTiming(1, { duration: 180 });
  }, [count, offset, opacity, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));
}
