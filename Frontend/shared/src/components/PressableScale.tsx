import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens, useMotionPreference } from '../design';

const useNativeDriver = Platform.OS !== 'web';

export type PressableScaleStyle =
  StyleProp<ViewStyle> | ((state: { readonly pressed: boolean }) => StyleProp<ViewStyle>);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  /** Visual style; pass a function to style the pressed state (e.g. a darker fill). */
  readonly style?: PressableScaleStyle;
  /** Style for the outer pressable, e.g. to let it stretch inside a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A pressable that sinks inward on touch and springs back on release, overshooting rest by a
 * hair before settling so the control feels physical. Skipped under reduced motion; the pressed
 * style still changes so feedback never depends on movement.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useMotionPreference();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: tokens.motion.press.scale,
      duration: tokens.motion.recipe.directResponse.durationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    }).start();
  };

  const release = () => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: tokens.motion.recipe.functionalTransition.durationMs,
      easing: Easing.out(Easing.back(tokens.motion.press.releaseOvershoot)),
      useNativeDriver,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(event) => {
        pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        release();
        onPressOut?.(event);
      }}
      {...rest}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            typeof style === 'function' ? style({ pressed }) : style,
            { transform: [{ scale }] },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
