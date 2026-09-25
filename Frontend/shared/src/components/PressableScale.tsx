import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptic, tokens, type HapticKind } from '../design';

export type PressableScaleStyle =
  StyleProp<ViewStyle> | ((state: { readonly pressed: boolean }) => StyleProp<ViewStyle>);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  /** Visual style; pass a function to style the pressed state (e.g. a darker fill). */
  readonly style?: PressableScaleStyle;
  /** Style for the outer pressable, e.g. to let it stretch inside a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
  /** The tactile answer on touch-down. Cards and rows use `none`; controls keep `tap`. */
  readonly haptic?: HapticKind;
  /** How far the control sinks. Large surfaces (cards, photos) sink less than buttons. */
  readonly depth?: 'control' | 'surface';
}

const sink = { control: 0.955, surface: 0.975 } as const;
const release = { damping: 14, stiffness: 280, mass: 0.7 } as const;

/**
 * A pressable that sinks on touch and springs back on release, overshooting rest by a hair so
 * it feels physical. Springs run on the UI thread, so the answer never waits on JavaScript.
 * Under reduced motion only the pressed style changes; feedback never depends on movement.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  haptic: hapticKind = 'tap',
  depth = 'control',
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withSpring(sink[depth], tokens.motion.spring.snappy);
        haptic(hapticKind);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) scale.value = withSpring(1, release);
        onPressOut?.(event);
      }}
      {...rest}
    >
      {({ pressed }) => (
        <Animated.View style={[typeof style === 'function' ? style({ pressed }) : style, animated]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
