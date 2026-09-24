import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

import { tokens, useMotionPreference } from '../design';

const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
const useNativeDriver = Platform.OS !== 'web';

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
}

/**
 * Entrance motion: content rises a short distance and settles in one beat. Transform and
 * opacity only, and never scale, so type stays crisp mid-flight. With reduced motion it becomes
 * a short cross-fade with no travel.
 */
export function Reveal({ children, index = 0, style }: RevealProps) {
  const { reduceMotion, preferenceResolved } = useMotionPreference();
  const gateOpen = useContext(RevealGateContext);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!preferenceResolved || !gateOpen) return;

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
  }, [gateOpen, index, preferenceResolved, progress, reduceMotion]);

  const transform = reduceMotion
    ? []
    : [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [tokens.motion.entrance.offsetY, 0],
          }),
        },
      ];

  return (
    <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>
  );
}
