import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

import { tokens, useMotionPreference } from '../design';

const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
const useNativeDriver = Platform.OS !== 'web';

export interface RevealProps {
  readonly children: ReactNode;
  /** Position in a staggered group. Items past the stagger cap enter with the last slot. */
  readonly index?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Entrance motion: content rises into place and settles. Transform and opacity only, so it
 * stays on the compositor. With reduced motion it becomes a short cross-fade with no travel.
 */
export function Reveal({ children, index = 0, style }: RevealProps) {
  const { reduceMotion, preferenceResolved } = useMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!preferenceResolved) return;

    const { limits, recipe } = tokens.motion;
    const slot = Math.min(index, limits.maximumStaggerItems - 1);
    const animation = reduceMotion
      ? Animated.timing(progress, {
          toValue: 1,
          duration: recipe.reducedCrossFade.durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        })
      : Animated.timing(progress, {
          toValue: 1,
          duration: recipe.entrance.durationMs,
          delay: slot * limits.staggerInterval,
          easing: expressive,
          useNativeDriver,
        });

    animation.start();
    return () => animation.stop();
  }, [index, preferenceResolved, progress, reduceMotion]);

  const { offsetY, scaleFrom } = tokens.motion.entrance;
  const transform = reduceMotion
    ? []
    : [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) },
      ];

  return (
    <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>
  );
}
