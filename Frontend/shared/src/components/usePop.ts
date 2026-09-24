import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

import { tokens, useMotionPreference } from '../design';

const useNativeDriver = Platform.OS !== 'web';

export interface PopOptions {
  /** Peak scale; below 1 makes the pop a dip, e.g. for withdrawing a like. */
  readonly peak?: number;
  /** When false, a change of `trigger` does nothing, e.g. only pop on becoming selected. */
  readonly enabled?: boolean;
}

/**
 * A scale that swells and squash-settles whenever `trigger` changes, never on mount. Both
 * beats together stay inside the artistic-motion ceiling, and reduced motion skips it.
 */
export function usePop(
  trigger: unknown,
  { peak = tokens.motion.pop.scale, enabled = true }: PopOptions = {},
) {
  const { reduceMotion } = useMotionPreference();
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(trigger);

  useEffect(() => {
    if (Object.is(previous.current, trigger)) return;
    previous.current = trigger;
    if (!enabled || reduceMotion) return;

    const { duration, pop } = tokens.motion;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: peak,
        duration: duration.popRise,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: duration.popSettle,
        easing: Easing.out(Easing.back(pop.overshoot)),
        useNativeDriver,
      }),
    ]).start();
  }, [enabled, peak, reduceMotion, scale, trigger]);

  return scale;
}

/**
 * Rolls a changing number into place: it arrives from below when it rises and from above when
 * it falls, so the direction of the change reads without comparing digits.
 */
export function useCountShift(count: number) {
  const { reduceMotion } = useMotionPreference();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previous = useRef(count);

  useEffect(() => {
    const delta = count - previous.current;
    previous.current = count;
    if (delta === 0 || reduceMotion) return;

    const { countShift, recipe } = tokens.motion;
    translateY.setValue(delta > 0 ? countShift.offsetY : -countShift.offsetY);
    opacity.setValue(0);
    const timing = { duration: recipe.functionalTransition.durationMs, useNativeDriver };
    Animated.parallel([
      Animated.timing(translateY, { ...timing, toValue: 0, easing: Easing.out(Easing.cubic) }),
      Animated.timing(opacity, { ...timing, toValue: 1, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, [count, opacity, reduceMotion, translateY]);

  return { opacity, transform: [{ translateY }] };
}
